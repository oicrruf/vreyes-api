#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Language dictionaries for commit messages
const translations = {
  en: {
    add: "add",
    update: "update",
    remove: "remove",
    file: "file",
    files: "files",
    splitRoutes: "split email routes into separate files",
    noStagedFiles: "No staged files found.",
    generatedMessage: "Generated commit message:",
    useMessage: "Do you want to use this commit message? (y/n) ",
    commitSuccess: "Commit created successfully!",
    commitError: "Error creating commit:",
    commitNotUsed:
      "Commit message not used. Please create your own commit message.",
    generateError: "Error generating commit message:",
    selectLanguage: "Select language for commit message (en/es): ",
    unstaged: "There are unstaged changes:",
    proceedWithout:
      "Do you want to proceed with the commit without including these files? (y/n) ",
    noChanges: "No modified files found.",
  },
  es: {
    add: "agregar",
    update: "actualizar",
    remove: "eliminar",
    file: "archivo",
    files: "archivos",
    splitRoutes: "separar rutas de email en archivos independientes",
    noStagedFiles: "No se encontraron archivos en stage.",
    generatedMessage: "Mensaje de commit generado:",
    useMessage: "¿Deseas usar este mensaje de commit? (s/n) ",
    commitSuccess: "¡Commit creado exitosamente!",
    commitError: "Error al crear el commit:",
    commitNotUsed:
      "Mensaje de commit no utilizado. Por favor crea tu propio mensaje de commit.",
    generateError: "Error al generar mensaje de commit:",
    selectLanguage: "Selecciona el idioma para el mensaje de commit (en/es): ",
    unstaged: "Hay cambios sin agregar al stage:",
    proceedWithout:
      "¿Quieres proceder con el commit sin incluir estos archivos? (s/n) ",
    noChanges: "No se encontraron archivos modificados.",
  },
};

/**
 * Check if all modified files are staged
 */
async function checkAllFilesStaged(language = "en") {
  const t = translations[language];

  try {
    // Get all modified files (including unstaged)
    const statusOutput = execSync("git status --porcelain").toString().trim();

    if (!statusOutput) {
      console.log(t.noChanges);
      return false;
    }

    const modifiedFiles = statusOutput.split("\n").filter(Boolean);

    // Check if there are unstaged changes
    const unstagedFiles = modifiedFiles
      .filter((line) => line.startsWith(" M") || line.startsWith("??"))
      .map((line) => line.slice(3)); // Extract filename

    if (unstagedFiles.length > 0) {
      console.log(t.unstaged);
      unstagedFiles.forEach((file) => console.log(`  - ${file}`));

      // Ask if user wants to proceed without these files
      const readline = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      return new Promise((resolve) => {
        readline.question(`\n${t.proceedWithout}`, (answer) => {
          const positiveAnswer = language === "es" ? "s" : "y";
          const proceed = answer.toLowerCase() === positiveAnswer;
          readline.close();
          resolve(proceed);
        });
      });
    }

    return true;
  } catch (error) {
    console.error(`Error checking files: ${error.message}`);
    return false;
  }
}

/**
 * Generate a conventional commit message based on the changes
 */
async function generateCommitMessage(language = null) {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let lang = language;

    if (!lang) {
      if (args.includes("--es")) {
        lang = "es";
      } else if (args.includes("--en")) {
        lang = "en";
      } else {
        lang = "en"; // Default language for initial checks
      }
    }

    // First check if all files are staged
    const shouldProceed = await checkAllFilesStaged(lang);
    if (!shouldProceed) {
      return;
    }

    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const proceedWithGeneration = (selectedLang) => {
      const t = translations[selectedLang];

      // Get the staged files
      const stagedFiles = execSync("git diff --cached --name-status")
        .toString()
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [status, filePath] = line.split(/\s+/);
          return { status, filePath };
        });

      if (stagedFiles.length === 0) {
        console.log(t.noStagedFiles);
        readline.close();
        return;
      }

      // Analyze the changes
      const types = {
        added: [],
        modified: [],
        deleted: [],
        renamed: [],
      };

      stagedFiles.forEach((file) => {
        if (file.status === "A") types.added.push(file.filePath);
        else if (file.status === "M") types.modified.push(file.filePath);
        else if (file.status === "D") types.deleted.push(file.filePath);
        else if (file.status.startsWith("R")) types.renamed.push(file.filePath);
      });

      // Determine the type of the commit
      let type = "chore";
      let scope = "";

      const allFiles = [...stagedFiles.map((f) => f.filePath)];
      const fileExtensions = [...new Set(allFiles.map((f) => path.extname(f)))];
      const directories = [
        ...new Set(allFiles.map((f) => path.dirname(f).split("/")[0])),
      ];

      // Check for new features
      if (types.added.length > 0) {
        type = "feat";
      }
      // Check for fixes/modifications
      else if (types.modified.length > 0) {
        type = "fix";
      }
      // Check if it's only documentation
      if (fileExtensions.every((ext) => [".md", ".txt"].includes(ext))) {
        type = "docs";
      }
      // Check if it's only tests
      if (
        allFiles.every((file) => file.includes("test") || file.includes("spec"))
      ) {
        type = "test";
      }
      // Check for refactoring
      if (
        types.renamed.length > 0 &&
        types.added.length > 0 &&
        types.deleted.length > 0
      ) {
        type = "refactor";
      }

      // Determine scope from directories
      if (directories.length === 1 && directories[0] !== ".") {
        scope = directories[0];
      } else if (allFiles.every((file) => file.includes("route"))) {
        scope = "routes";
      } else if (allFiles.every((file) => file.includes("service"))) {
        scope = "services";
      }

      // Generate the commit message
      let commitMessage = "";

      // For our specific case of splitting routes
      if (
        allFiles.some((file) => file.includes("emailRoutes")) &&
        allFiles.some(
          (file) =>
            file.includes("currentMonthEmailRoutes") ||
            file.includes("emailAttachmentsRoutes")
        )
      ) {
        type = "refactor";
        scope = "routes";
        commitMessage = `${type}(${scope}): ${t.splitRoutes}`;
      } else {
        // Generate a basic description based on changes
        let description = "";

        if (types.added.length > 0) {
          description = `${t.add} ${types.added.length} ${
            types.added.length > 1 ? t.files : t.file
          }`;
        } else if (types.modified.length > 0) {
          description = `${t.update} ${types.modified.length} ${
            types.modified.length > 1 ? t.files : t.file
          }`;
        } else if (types.deleted.length > 0) {
          description = `${t.remove} ${types.deleted.length} ${
            types.deleted.length > 1 ? t.files : t.file
          }`;
        }

        commitMessage = scope
          ? `${type}(${scope}): ${description}`
          : `${type}: ${description}`;
      }

      console.log(`\n${t.generatedMessage}`);
      console.log("------------------------");
      console.log(commitMessage);
      console.log("------------------------");

      // Ask if the user wants to use this commit message
      readline.question(`\n${t.useMessage}`, (answer) => {
        const positiveAnswer = selectedLang === "es" ? "s" : "y";
        if (answer.toLowerCase() === positiveAnswer) {
          try {
            execSync(`git commit -m "${commitMessage}"`);
            console.log(t.commitSuccess);
          } catch (error) {
            console.error(`${t.commitError} ${error.message}`);
          }
        } else {
          console.log(t.commitNotUsed);
        }
        readline.close();
      });
    };

    // If language is not determined from args, ask for it
    if (lang !== "en" && lang !== "es") {
      readline.question(translations.en.selectLanguage, (answer) => {
        const selectedLang = answer.toLowerCase() === "es" ? "es" : "en";
        proceedWithGeneration(selectedLang);
      });
    } else {
      proceedWithGeneration(lang);
    }
  } catch (error) {
    console.error(`${translations.en.generateError} ${error.message}`);
  }
}

// Convert main function to async
(async () => {
  await generateCommitMessage();
})();
