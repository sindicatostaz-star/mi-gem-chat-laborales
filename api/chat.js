// api/chat.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
    
    // CONFIGURACIÓN:
    // Asegúrate de que este nombre es EXACTO (mayúsculas/minúsculas importan en Vercel)
    const misArchivos = ['acuerdocongrados.pdf']; 
    const modelName = "gemini-2.0-flash";

    const { history } = req.body;

    try {
        let parts = [];
        let archivosEncontrados = 0;

        // 1. INTENTO DE LEER ARCHIVOS CON RASTREO DE RUTA
        console.log("--- INICIO DIAGNÓSTICO ---");
        console.log("Directorio actual (cwd):", process.cwd());

        for (const fileName of misArchivos) {
            // Vercel a veces mueve los archivos. Probamos 2 rutas posibles:
            const ruta1 = path.join(process.cwd(), 'api', fileName);
            const ruta2 = path.join(process.cwd(), fileName); // A veces están en la raíz

            let filePathFinal = null;
            
            if (fs.existsSync(ruta1)) {
                filePathFinal = ruta1;
            } else if (fs.existsSync(ruta2)) {
                filePathFinal = ruta2;
            }

            if (filePathFinal) {
                console.log(`✅ Archivo encontrado en: ${filePathFinal}`);
                const fileBuffer = fs.readFileSync(filePathFinal);
                parts.push({
                    inline_data: {
                        mime_type: "application/pdf",
                        data: fileBuffer.toString('base64')
                    }
                });
                archivosEncontrados++;
            } else {
                console.error(`❌ ERROR CRÍTICO: No encuentro el archivo '${fileName}' en ninguna ruta.`);
                console.error(`Busqué en: ${ruta1} Y TAMBIÉN EN: ${ruta2}`);
            }
        }

        if (archivosEncontrados === 0) {
            // Si no encontró el PDF, devolvemos el error al chat para que lo veas
            return res.status(500).json({ 
                error: `ERROR DE ARCHIVO: No encontré '${misArchivos[0]}' en el servidor. Revisa mayúsculas/minúsculas.` 
            });
        }

        // 2. PREPARAR PROMPT
        const SYSTEM_PROMPT = `
        Eres el Asistente del Sindicato STAZ.
        Responde basándote EXCLUSIVAMENTE en el documento PDF adjunto.
        Si la respuesta no está en el PDF, di: "Esa información no aparece en el acuerdo."
        `;

        parts.push({ text: SYSTEM_PROMPT });
        const lastUserMessage = history[history.length - 1].parts[0].text;
        parts.push({ text: "Pregunta del usuario: " + lastUserMessage });

        // 3. LLAMADA A GOOGLE
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: parts }] })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error Google:", JSON.stringify(data));
            return res.status(response.status).json({ error: "Error de Google: " + (data.error?.message || "Desconocido") });
        }

        console.log("✅ Google respondió correctamente");
        res.status(200).json(data);

    } catch (error) {
        console.error("Error del Servidor:", error);
        res.status(500).json({ error: "Error interno del servidor: " + error.message });
    }
}
