export async function compressImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("PNG, JPG, WEBP 이미지만 등록할 수 있습니다.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("원본 이미지는 10MB 이하로 등록해 주세요.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () =>
      reject(new Error("손상되었거나 지원하지 않는 이미지입니다."));
    i.src = data;
  });
  const canvas = document.createElement("canvas");
  const size = 300;
  const ratio = Math.min(1, size / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저는 이미지 변환을 지원하지 않습니다.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  let result = canvas.toDataURL("image/webp", 0.8);
  if (result.length > 125000) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    result = canvas.toDataURL("image/jpeg", 0.65);
  }
  if (result.length > 125000)
    throw new Error(
      "이미지가 너무 복잡합니다. 더 작은 이미지를 사용해 주세요.",
    );
  return result;
}
