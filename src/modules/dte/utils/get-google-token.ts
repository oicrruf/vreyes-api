import { google } from 'googleapis';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function getRefreshToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('ERROR: Debes configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en tu archivo .env antes de correr este script.');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob' // Redirect URI for Desktop apps
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force to get refresh token
  });

  console.log('\n1. Abre este enlace en tu navegador para autorizar la aplicación:');
  console.log('------------------------------------------------------------');
  console.log(authUrl);
  console.log('------------------------------------------------------------\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('2. Pega aquí el código de autorizacíon (o el código que aparece en la URL después de redirigir): ', async (code) => {
    rl.close();
    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log('\n¡ÉXITO! Aquí están tus credenciales para el archivo .env:\n');
      console.log('------------------------------------------------------------');
      console.log(`GOOGLE_CLIENT_ID=${clientId}`);
      console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('------------------------------------------------------------');
      console.log('\nCopia el GOOGLE_REFRESH_TOKEN y pégalo en tu archivo .env.');
    } catch (error) {
      console.error('Error al obtener el token:', error);
    }
  });
}

getRefreshToken();
