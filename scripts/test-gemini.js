const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is missing.");
  process.exit(1);
}

async function main() {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: `models/gemini-embedding-2`,
        content: { parts: [{ text: "Hello" }] },
        outputDimensionality: 768
      }),
    }
  );
  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Dimension size:", data.embedding?.values?.length);
}
main();
