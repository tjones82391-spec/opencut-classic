#!/usr/bin/env node

/**
 * Generate an AI image for the OpenCut project using fal.ai.
 *
 * Usage:
 *   FAL_KEY=your_api_key node script/generate-image.mjs [prompt]
 *
 * If no prompt is provided, a default OpenCut-themed prompt is used.
 *
 * The generated image is saved to the current directory as "generated-image.png".
 *
 * Get your API key at https://fal.ai/dashboard/keys
 */

const FAL_KEY = process.env.FAL_KEY;

if (!FAL_KEY) {
  console.error("Error: FAL_KEY environment variable is required.");
  console.error("Get your key at https://fal.ai/dashboard/keys");
  process.exit(1);
}

const defaultPrompt = [
  "A sleek, modern video editor interface floating in a dark void,",
  "neon-accented timeline with colorful clips, glowing playhead,",
  "minimal and futuristic design, open-source aesthetic,",
  "cinematic lighting, 4k, ultrasharp",
].join(" ");

const prompt = process.argv.slice(2).join(" ") || defaultPrompt;

console.log(`Prompt: ${prompt}\n`);
console.log("Generating image...");

const response = await fetch("https://queue.fal.run/fal-ai/flux/dev", {
  method: "POST",
  headers: {
    Authorization: `Key ${FAL_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt,
    image_size: "landscape_16_9",
    num_images: 1,
  }),
});

if (!response.ok) {
  const text = await response.text();
  console.error(`fal.ai API error (${response.status}): ${text}`);
  process.exit(1);
}

const result = await response.json();

// fal.ai queue returns a request_id for async processing
if (result.request_id) {
  console.log("Request queued. Polling for result...");

  let status = "IN_QUEUE";
  let finalResult = null;

  while (status !== "COMPLETED") {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusResponse = await fetch(
      `https://queue.fal.run/fal-ai/flux/dev/requests/${result.request_id}/status`,
      { headers: { Authorization: `Key ${FAL_KEY}` } }
    );
    const statusData = await statusResponse.json();
    status = statusData.status;
    console.log(`  Status: ${status}`);

    if (status === "COMPLETED") {
      const resultResponse = await fetch(
        `https://queue.fal.run/fal-ai/flux/dev/requests/${result.request_id}`,
        { headers: { Authorization: `Key ${FAL_KEY}` } }
      );
      finalResult = await resultResponse.json();
    }
  }

  await saveImage(finalResult);
} else if (result.images) {
  await saveImage(result);
} else {
  console.error("Unexpected response:", JSON.stringify(result, null, 2));
  process.exit(1);
}

async function saveImage(data) {
  const imageUrl = data.images[0].url;
  console.log(`\nImage URL: ${imageUrl}`);

  const imageResponse = await fetch(imageUrl);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  const { writeFile } = await import("node:fs/promises");
  const outputPath = "generated-image.png";
  await writeFile(outputPath, buffer);
  console.log(`Saved to: ${outputPath}`);
}
