import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    // Permitir CORS para que funcione desde tu web real si hace falta
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
    
    // --- CONFIGURACIÓN ---
    const pdfName = 'acuerdocongrados.pdf'; // ASEGÚRATE QUE EN GITHUB SE LLAMA IGUAL
    const modelName = "gemini-2.5-flash";
    // ---------------------

    const { history } = req.body;

    try {
        // 1. BUSCAR EL ARCHIVO PDF INTELIGENTEMENTE
        const filePath = path.join(process.cwd(), 'api', pdfName);
        
        let pdfDataBase64 = null;

        if (fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath);
            pdfDataBase64 = fileBuffer.toString('base64');
            console.log("✅ PDF cargado correctamente");
        } else {
            // Si no lo encuentra, NO ROMPEMOS EL CHAT (Evitamos Error 500)
            console.warn(`⚠️ ALERTA: No encuentro el archivo en ${filePath}`);
            // Intentamos buscarlo en la raíz por si acaso
            const rootPath = path.join(process.cwd(), pdfName);
            if (fs.existsSync(rootPath)) {
                 const fileBuffer = fs.readFileSync(rootPath);
                 pdfDataBase64 = fileBuffer.toString('base64');
                 console.log("✅ PDF encontrado en la raíz");
            }
        }

        // 2. PREPARAR MENSAJE PARA GOOGLE
        let parts = [];

        // Si encontramos el PDF, lo adjuntamos
        if (pdfDataBase64) {
            parts.push({
                inline_data: {
                    mime_type: "application/pdf",
                    data: pdfDataBase64
                }
            });
            parts.push({ text: "INSTRUCCIÓN: Responde basándote estrictamente en el documento PDF adjunto." });
        } else {
            // Si falló la carga, avisamos al sistema pero dejamos que funcione
            parts.push({ text: "AVISO CRÍTICO AL SISTEMA: El archivo PDF no se ha podido leer del servidor. Informa al usuario de que hay un problema técnico con el documento, pero intenta responder si sabes la respuesta por cultura general." });
        }

        // Añadimos la pregunta del usuario
        const lastUserMessage = history[history.length - 1].parts[0].text;
        parts.push({ text: "Pregunta del usuario: " + lastUserMessage });

        // 3. ENVIAR A GOOGLE
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: parts }] })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.status(200).json(data);

    } catch (error) {
        console.error("Error interno:", error);
        res.status(500).json({ error: error.message });
    }
}
