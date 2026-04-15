export const isPdfAttachment = (attachment: any): boolean => {
  return (
    attachment.contentType === "application/pdf" ||
    (attachment.filename && attachment.filename.toLowerCase().endsWith(".pdf"))
  );
};

export const isJsonAttachment = (attachment: any): boolean => {
  return (
    attachment.contentType === "application/json" ||
    (attachment.filename && attachment.filename.toLowerCase().endsWith(".json"))
  );
};

export const parseJsonAttachment = (attachment: any): any => {
  try {
    const jsonContent = attachment.content.toString("utf-8").trim(); // Trim whitespace
    return JSON.parse(jsonContent);
  } catch (error) {
    const err = error as Error; // Explicitly cast error to Error
    console.error("Error parsing JSON attachment:", err.message);
    console.error(
      "Invalid JSON content:",
      attachment.content.toString("utf-8")
    ); // Log problematic content
    return null; // Return null for invalid JSON
  }
};

export const checkNrcInJson = (jsonData: any, targetNrc: string): boolean => {
  if (!jsonData) return false;

  // Direct check for NRC property
  if (jsonData.nrc && jsonData.nrc === targetNrc) {
    return true;
  }

  // Check for nested properties
  for (const key in jsonData) {
    if (typeof jsonData[key] === "object" && jsonData[key] !== null) {
      // Recursively check nested objects
      if (checkNrcInJson(jsonData[key], targetNrc)) {
        return true;
      }
    }
  }

  return false;
};
