import { handleGenerate } from "@/lib/server/generate";

export const runtime = "edge";

export const POST = handleGenerate;
