import { mkdir, readFile, readdir, writeFile } from "fs/promises"
import path from "path"

const dataDir = path.join(process.cwd(), "data")

async function ensureDir(...parts: string[]) {
  const dir = path.join(dataDir, ...parts)
  await mkdir(dir, { recursive: true })
  return dir
}

export async function saveJson<T>(collection: string, id: string, value: T) {
  const dir = await ensureDir(collection)
  await writeFile(path.join(dir, `${id}.json`), JSON.stringify(value, null, 2))
}

export async function readJson<T>(collection: string, id: string): Promise<T> {
  const file = path.join(dataDir, collection, `${id}.json`)
  return JSON.parse(await readFile(file, "utf8")) as T
}

export async function listJson<T>(collection: string): Promise<T[]> {
  const dir = await ensureDir(collection)
  const files = await readdir(dir)
  const jsonFiles = files.filter((file) => file.endsWith(".json"))
  return Promise.all(jsonFiles.map(async (file) => JSON.parse(await readFile(path.join(dir, file), "utf8")) as T))
}

export async function saveAsset(collection: string, id: string, filename: string, dataUrl: string) {
  const dir = await ensureDir(collection, id)
  const [, encoded] = dataUrl.split(",")
  const ext = dataUrl.includes("image/png") ? "png" : "bin"
  const assetName = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`
  const fullPath = path.join(dir, assetName)
  await writeFile(fullPath, Buffer.from(encoded ?? dataUrl, "base64"))
  return fullPath
}
