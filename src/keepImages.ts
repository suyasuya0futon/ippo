const MAX_EDGE = 2000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name || "画像"}を読み込めませんでした`));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("画像を圧縮できませんでした"))),
      "image/webp",
      quality
    );
  });
}

/** スクショを長辺2000px以下の WebP にし、無料枠の消費を抑える。 */
export async function prepareKeepImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("画像ファイルだけ添付できます");
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を処理できませんでした");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let blob = await canvasBlob(canvas, 0.82);
  if (blob.size > MAX_FILE_BYTES) blob = await canvasBlob(canvas, 0.68);
  if (blob.size > MAX_FILE_BYTES) blob = await canvasBlob(canvas, 0.52);
  if (blob.size > MAX_FILE_BYTES) throw new Error("画像が大きすぎます（5MB以下にしてください）");

  const baseName = (file.name || "screenshot").replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}
