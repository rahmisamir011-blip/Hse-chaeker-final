const busboy = require("busboy");

function parseMultipartForm(event) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const bb = busboy({
      headers: {
        "content-type": event.headers["content-type"] || event.headers["Content-Type"]
      }
    });

    bb.on("file", (name, file, info) => {
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        fields[name] = {
          filename: info.filename,
          mimeType: info.mimeType,
          content: Buffer.concat(chunks)
        };
      });
    });

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("close", () => resolve(fields));
    bb.on("error", (err) => reject(err));
    bb.end(Buffer.from(event.body, "base64"));
  });
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "API key missing" }) };
    }

    const parsedForm = await parseMultipartForm(event);
    const imageFile = parsedForm.image;

    if (!imageFile) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No image" }) };
    }

    const base64Image = imageFile.content.toString("base64");
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Analyze PPE compliance. Check: Hairnet, Mask, Protective suit, Gloves, Safety shoes. Return JSON: {findings:[{ppeItem:string,compliant:boolean,reason:string(Arabic),boundingBox:{x:0.1,y:0.1,width:0.2,height:0.2}}],summary:string(Arabic),overallCompliant:boolean}" },
              { inline_data: { mime_type: imageFile.mimeType, data: base64Image } }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || "API error");
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    if (text.includes("```
      text = text.replace(/```json/g, "").replace(/```
    }

    let result;
    try {
      result = JSON.parse(text);
      if (!result.findings) result.findings = [];
    } catch (e) {
      result = {
        findings: [
          { ppeItem: "Hairnet", compliant: false, reason: "فشل", boundingBox: { x: 0, y: 0, width: 1, height: 1 } }
        ],
        summary: "خطأ",
        overallCompliant: false
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
