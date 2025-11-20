// api/chat.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
    if (!apiKey) {
        return res.status(500).json({ error: "API Key no encontrada" });
    }

    const { history } = req.body;

    // 1. INSTRUCCIONES DE PERSONALIDAD
    const SYSTEM_PROMPT = `
    Eres un asistente experto, educado y profesional.
    Tienes acceso a un documento PDF adjunto llamado "Acuerdo con Grados".
    Responde a las preguntas del usuario basándote ÚNICAMENTE en la información de ese PDF.
    Si la respuesta no está en el documento, indícalo amablemente.
    `;

    try {
        // 2. LEER EL ARCHIVO 'acuerdocongrados.pdf'
        // --- CAMBIO AQUÍ ---
        const fileName = 'Acuerdocongrados.pdf';
        const filePath = path.join(process.cwd(), 'api', fileName);
        
        // Leemos el archivo y lo convertimos a Base64
        const fileBuffer = fs.readFileSync(filePath);
        const base64Data = fileBuffer.toString('base64');

        // 3. PREPARAR EL MENSAJE
        let parts = [];

        // Añadimos el PDF al contexto
        parts.push({
            inline_data: {
                mime_type: "application/pdf",
                data: base64Data
            }
        });
        
        // Añadimos las instrucciones
        parts.push({ text: SYSTEM_PROMPT });

        // Añadimos la última pregunta del usuario
        const lastUserMessage = history[history.length - 1].parts[0].text;
        parts.push({ text: "Pregunta del usuario: " + lastUserMessage });

        // 4. ENVIAR A GOOGLE (Modelo Gemini 2.0 Flash)
        const modelName = "gemini-2.5-pro-preview-03-25"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [
                {
                    role: "user",
                    parts: parts 
                }
            ]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error Google:", JSON.stringify(data));
            return res.status(response.status).json(data);
        }

        res.status(200).json(data);

    } catch (error) {
        console.error("Error:", error);
        // Mensaje de error útil por si el archivo no está bien puesto
        res.status(500).json({ error: `No pude leer el archivo ${fileName}. Asegúrate de que está en la carpeta 'api/'` });
    }
}
