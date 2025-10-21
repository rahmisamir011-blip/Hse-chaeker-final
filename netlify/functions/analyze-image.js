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
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "Analyze PPE. Check: Hairnet, Mask, Suit, Gloves, Shoes. Return JSON."
              },
              { inline_data: { mime_type: imageFile.mimeType, data: base64Image } }
            ]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error && data.error.message ? data.error.message : "API error");
    }

    let text = "";
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      text = data.candidates[0].content.parts[0].text;
    } else {
      text = "{}";
    }

    if (text.indexOf("```
      text = text.replace(/```json/g, "").replace(/```
    }

    let result;
    try {
      result = JSON.parse(text);
      if (!result.findings) result.findings = [];
    } catch (e) {
      result = {
        findings: [{ ppeItem: "Error", compliant: false, reason: "Failed" }],
        summary: "Error",
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
