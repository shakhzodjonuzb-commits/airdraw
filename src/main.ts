import { App, COLORS } from "./app";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const app = new App();

const colors = $("colors");
COLORS.forEach((c, i) => {
  const b = document.createElement("button");
  b.style.background = c; b.setAttribute("aria-label", `Rang ${i + 1}`);
  if (i === 0) b.classList.add("on");
  b.onclick = () => {
    app.color = c;
    colors.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
  };
  colors.appendChild(b);
});

$<HTMLInputElement>("size").oninput = (e) => { app.width = Number((e.target as HTMLInputElement).value); };
$("undo").onclick = () => app.undo();
$("clear").onclick = () => app.clear();
$("save").onclick = () => app.save();
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") app.undo();
});

const go = $<HTMLButtonElement>("go"), msg = $("msg");
go.onclick = async () => {
  go.disabled = true; msg.textContent = "Kamera va model yuklanmoqda…";
  try {
    await app.start();
    $("start").classList.add("hide");
  } catch (err) {
    go.disabled = false;
    const denied = err instanceof DOMException && err.name === "NotAllowedError";
    msg.textContent = denied
      ? "Kameraga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering va qayta urining."
      : "Xatolik: " + (err instanceof Error ? err.message : String(err));
  }
};
