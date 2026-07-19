const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is missing.");
  process.exit(1);
}

async function main() {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`,
  );
  const data = await response.json();
  const models = data.models.filter(m => m.name.includes("embedding"));
  console.log(models.map(m => m.name));
}
main();
