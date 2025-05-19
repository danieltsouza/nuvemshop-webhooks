const express = require('express');
const crypto = require('crypto');
const { google } = require('googleapis');
const app = express();
app.use(express.json());

// Configurações (carregadas do .env ou variáveis do Railway)
const APP_SECRET = process.env.APP_SECRET;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS); // Credenciais JSON

// Autenticação com Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Função para verificar HMAC
function verifyWebhook(data, hmacHeader) {
  const calculatedHmac = crypto
    .createHmac('sha256', APP_SECRET)
    .update(JSON.stringify(data))
    .digest('base64');
  return hmacHeader === calculatedHmac;
}

// Endpoint para store/redact
app.post('/store-redact', async (req, res) => {
  const hmacHeader = req.get('x-linkedstore-hmac-sha256');
  if (!verifyWebhook(req.body, hmacHeader)) {
    return res.status(401).send('HMAC verification failed');
  }

  const { store_id } = req.body;
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'PedidosNuvem!A:E',
    });
    const rows = response.data.values || [];
    const filteredRows = rows.filter(row => !row[1].includes(`store_${store_id}`));
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'PedidosNuvem!A:E',
      valueInputOption: 'RAW',
      resource: { values: filteredRows },
    });
    res.status(200).send('Store data deleted');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing store/redact');
  }
});

// Endpoint para customers/redact
app.post('/customers-redact', async (req, res) => {
  const hmacHeader = req.get('x-linkedstore-hmac-sha256');
  if (!verifyWebhook(req.body, hmacHeader)) {
    return res.status(401).send('HMAC verification failed');
  }

  const { store_id, customer } = req.body;
  const email = customer.email;
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'PedidosNuvem!A:E',
    });
    const rows = response.data.values || [];
    const filteredRows = rows.filter(row => row[1] !== email);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'PedidosNuvem!A:E',
      valueInputOption: 'RAW',
      resource: { values: filteredRows },
    });
    res.status(200).send('Customer data deleted');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing customers/redact');
  }
});

// Endpoint para customers/data_request
app.post('/customers-data-request', async (req, res) => {
  const hmacHeader = req.get('x-linkedstore-hmac-sha256');
  if (!verifyWebhook(req.body, hmacHeader)) {
    return res.status(401).send('HMAC verification failed');
  }

  const { store_id, customer, orders_requested } = req.body;
  const email = customer.email;
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'PedidosNuvem!A:E',
    });
    const rows = response.data.values || [];
    const customerData = rows.filter(row => row[1] === email);
    console.log('Customer data:', customerData);
    // TODO: Enviar relatório ao lojista (ex.: via email, configurado posteriormente)
    res.status(200).send('Customer data request processed');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing customers/data_request');
  }
});

// Iniciar o servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
