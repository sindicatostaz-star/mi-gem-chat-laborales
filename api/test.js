// api/test.js
export default async function handler(req, res) {
    // Limpiamos la clave por si copiaste un espacio al final sin querer
    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";

    if (!apiKey) {
        return res.status(500).json({ error: "No hay API Key configurada en Vercel" });
    }

    // Preguntamos a Google: "¿Qué modelos tengo disponibles?"
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
