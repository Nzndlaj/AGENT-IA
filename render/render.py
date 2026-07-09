#!/usr/bin/env python3
"""
Usine de rendu reels "Top 10" v2 — animations stylées, 100% gratuit.
- Photos de fond par item via Pexels (optionnel, secret PEXELS_API_KEY)
- Ken Burns (zoom lent), textes qui glissent, numéro avec rebond,
  barre avec halo lumineux, flash doré sur le n°1
- Voix off edge-tts (fr-FR-RemyMultilingualNeural par défaut)

Env requis : SUPABASE_URL, SUPABASE_SERVICE_KEY, REEL_ID
Env optionnel : PEXELS_API_KEY (photos de fond)
"""

import asyncio
import json
import math
import os
import shutil
import subprocess
import sys

import requests
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

# ---------------------------------------------------------------- config
W, H = 1080, 1920
FPS = 30
BG_TOP = (2, 6, 23)
BG_BOTTOM = (15, 23, 42)
WHITE = (245, 245, 245, 255)
GREY = (170, 184, 204, 255)
GOLD = (255, 199, 44)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
if os.path.exists("assets/font-bold.ttf"):
    FONT_BOLD = "assets/font-bold.ttf"

DUR_HOOK = 3.4
DUR_ITEM = 3.0
DUR_TOP1 = 4.4
DUR_OUTRO = 3.0

WORK = "work"
FRAMES = f"{WORK}/frames"
AUDIO = f"{WORK}/audio"
CACHE = f"{WORK}/img"


# ---------------------------------------------------------------- easing
def ease_out_cubic(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def ease_out_back(t):
    t = max(0.0, min(1.0, t))
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def hex_to_rgb(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def font(size):
    return ImageFont.truetype(FONT_BOLD, size)


# ---------------------------------------------------------------- fonds
ZOOM_SCALE = 1.2  # les fonds sont préparés 20% plus grands pour le ken burns


def prepare_photo(path):
    """Photo -> cover 1080x1920 agrandie, assombrie, légèrement floutée."""
    img = Image.open(path).convert("RGB")
    tw, th = int(W * ZOOM_SCALE), int(H * ZOOM_SCALE)
    ratio = max(tw / img.width, th / img.height)
    img = img.resize((int(img.width * ratio) + 1, int(img.height * ratio) + 1))
    left = (img.width - tw) // 2
    top = (img.height - th) // 2
    img = img.crop((left, top, left + tw, top + th))
    img = img.filter(ImageFilter.GaussianBlur(3))
    img = ImageEnhance.Brightness(img).enhance(0.45)
    return img


def fetch_pexels_photo(query, idx):
    key = os.environ.get("PEXELS_API_KEY", "")
    if not key or not query:
        return None
    cache_path = f"{CACHE}/{idx}.jpg"
    try:
        r = requests.get("https://api.pexels.com/v1/search",
                         params={"query": query, "per_page": 1,
                                 "orientation": "portrait"},
                         headers={"Authorization": key}, timeout=20)
        r.raise_for_status()
        photos = r.json().get("photos", [])
        if not photos:
            return None
        url = photos[0]["src"].get("large2x") or photos[0]["src"]["large"]
        img = requests.get(url, timeout=30)
        img.raise_for_status()
        with open(cache_path, "wb") as f:
            f.write(img.content)
        return prepare_photo(cache_path)
    except Exception:
        return None


def gradient_bg(accent):
    """Fond dégradé sombre + halo accent, préparé en grand pour le zoom."""
    tw, th = int(W * ZOOM_SCALE), int(H * ZOOM_SCALE)
    img = Image.new("RGB", (tw, th))
    d = ImageDraw.Draw(img)
    for y in range(th):
        t = y / th
        c = tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (tw, y)], fill=c)
    halo = Image.new("RGB", (tw, th), (0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse([tw // 2 - 560, -420, tw // 2 + 560, 420], fill=accent)
    hd.ellipse([-300, th - 500, 500, th + 400],
               fill=tuple(int(c * 0.6) for c in accent))
    halo = halo.filter(ImageFilter.GaussianBlur(280))
    return Image.blend(img, halo, 0.3)


def ken_burns(big, t):
    """Crop animé : zoom lent de 1.02 vers 1.10."""
    zoom = 1.02 + 0.08 * t
    cw, ch = int(W * ZOOM_SCALE / zoom), int(H * ZOOM_SCALE / zoom)
    left = (big.width - cw) // 2
    top = (big.height - ch) // 2
    return big.crop((left, top, left + cw, top + ch)).resize((W, H))


# ---------------------------------------------------------------- dessin
def draw_text_center(layer, y, text, fnt, fill, alpha=1.0, dy=0, max_width=W - 120):
    d = ImageDraw.Draw(layer)
    words = str(text).split()
    lines, cur = [], ""
    for w_ in words:
        test = (cur + " " + w_).strip()
        if d.textlength(test, font=fnt) <= max_width:
            cur = test
        else:
            lines.append(cur)
            cur = w_
    lines.append(cur)
    a = int(255 * max(0.0, min(1.0, alpha)))
    col = (fill[0], fill[1], fill[2], a)
    yy = y + dy
    for line in lines:
        tw = d.textlength(line, font=fnt)
        # ombre portée légère
        d.text(((W - tw) // 2 + 3, yy + 3), line, font=fnt, fill=(0, 0, 0, int(a * 0.6)))
        d.text(((W - tw) // 2, yy), line, font=fnt, fill=col)
        yy += fnt.size + 14
    return yy


def draw_pill(layer, text, y):
    d = ImageDraw.Draw(layer)
    f = font(44)
    tw = d.textlength(text, font=f)
    pad = 34
    x0 = (W - tw) // 2 - pad
    d.rounded_rectangle([x0, y, x0 + tw + 2 * pad, y + 78], 39,
                        fill=(255, 255, 255, 26))
    d.text(((W - tw) // 2, y + 14), text, font=f, fill=WHITE)


def draw_glow_bar(base, y0, width_px, accent, gold=False):
    """Barre arrondie avec halo lumineux dessous."""
    color = GOLD if gold else accent
    bar_max = W - 240
    strip = Image.new("RGBA", (W, 240), (0, 0, 0, 0))
    sd = ImageDraw.Draw(strip)
    sd.rounded_rectangle([120, 80, 120 + bar_max, 156], 38, fill=(255, 255, 255, 22))
    if width_px > 76:
        sd.rounded_rectangle([120, 80, 120 + width_px, 156], 38,
                             fill=color + (255,))
    glow = strip.filter(ImageFilter.GaussianBlur(16))
    base.alpha_composite(glow, (0, y0 - 80))
    base.alpha_composite(strip, (0, y0 - 80))


# ---------------------------------------------------------------- scènes
def frames_hook(bg_big, data, accent, n_frames):
    out = []
    for i in range(n_frames):
        t = i / n_frames
        frame = ken_burns(bg_big, t).convert("RGBA")
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        pop = ease_out_back(min(1.0, t * 2.6))
        f_t = font(max(12, int(96 * pop)))
        draw_text_center(layer, 540, data["titre_ecran"], f_t, WHITE[:3])
        if t > 0.3:
            a = ease_out_cubic((t - 0.3) / 0.35)
            draw_text_center(layer, 1040, data["hook"], font(56), accent,
                             alpha=a, dy=int((1 - a) * 50))
        if t > 0.62:
            a = ease_out_cubic((t - 0.62) / 0.3)
            draw_text_center(layer, 1560, "⬇ du 10 au 1 ⬇", font(46),
                             GREY[:3], alpha=a)
        frame.alpha_composite(layer)
        out.append(frame.convert("RGB"))
    return out


def frames_item(bg_big, rank, total, item, accent, n_frames, is_top1=False):
    out = []
    color = GOLD if is_top1 else accent
    for i in range(n_frames):
        t = i / n_frames
        frame = ken_burns(bg_big, t).convert("RGBA")
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))

        draw_pill(layer, f"{rank} / {total}", 150)

        # numéro avec rebond
        pop = ease_out_back(min(1.0, t * 3.2))
        f_rank = font(max(12, int((300 if is_top1 else 240) * pop)))
        d = ImageDraw.Draw(layer)
        rtxt = f"#{rank}"
        twn = d.textlength(rtxt, font=f_rank)
        d.text(((W - twn) // 2 + 4, 400 + 4), rtxt, font=f_rank,
               fill=(0, 0, 0, 150))
        d.text(((W - twn) // 2, 400), rtxt, font=f_rank, fill=color + (255,))

        # label qui glisse
        if t > 0.12:
            a = ease_out_cubic((t - 0.12) / 0.35)
            draw_text_center(layer, 800, item["label"],
                             font(92 if is_top1 else 80), WHITE[:3],
                             alpha=a, dy=int((1 - a) * 70))

        # barre + halo
        prog = ease_out_cubic(min(1.0, t / 0.55)) * (item.get("score", 50) / 100)
        draw_glow_bar(layer, 1180, int((W - 240) * prog), accent, gold=is_top1)

        # valeur qui pop
        if t > 0.42:
            a = ease_out_back(min(1.0, (t - 0.42) / 0.3))
            draw_text_center(layer, 1310, item["valeur"],
                             font(max(12, int(70 * min(1.0, a)))), WHITE[:3])

        # punchline ironique qui glisse
        punch = item.get("punchline", "")
        if punch and t > 0.55:
            a = ease_out_cubic((t - 0.55) / 0.3)
            draw_text_center(layer, 1450, punch, font(46), GREY[:3],
                             alpha=a, dy=int((1 - a) * 40))

        if is_top1:
            draw_text_center(layer, 300, "🏆 LE N°1", font(56), GOLD)

        frame.alpha_composite(layer)
        # flash doré à la révélation du n°1
        if is_top1 and i < 5:
            flash = Image.new("RGBA", (W, H), GOLD + (int(160 * (1 - i / 5)),))
            frame.alpha_composite(flash)
        out.append(frame.convert("RGB"))
    return out


def frames_outro(bg_big, data, accent, n_frames):
    out = []
    for i in range(n_frames):
        t = i / n_frames
        frame = ken_burns(bg_big, t).convert("RGBA")
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        a = ease_out_cubic(min(1.0, t * 3))
        draw_text_center(layer, 800, data.get("cta", "Abonne-toi"),
                         font(78), WHITE[:3], alpha=a, dy=int((1 - a) * 60))
        # bouton qui pulse
        pulse = 1 + 0.04 * math.sin(t * math.pi * 4)
        bw, bh = int(460 * pulse), int(116 * pulse)
        d = ImageDraw.Draw(layer)
        d.rounded_rectangle([W // 2 - bw // 2, 1150 - bh // 2 + 58,
                             W // 2 + bw // 2, 1150 + bh // 2 + 58], 28,
                            fill=hex_to_rgb("#7c3aed") + (255,) if accent is None else accent + (255,))
        f_btn = font(56)
        btxt = "S'ABONNER"
        twb = d.textlength(btxt, font=f_btn)
        d.text(((W - twb) // 2, 1150 + 58 - 28), btxt, font=f_btn, fill=WHITE)
        frame.alpha_composite(layer)
        out.append(frame.convert("RGB"))
    return out


# ---------------------------------------------------------------- audio
async def tts(text, voice, out_mp3):
    import edge_tts
    await edge_tts.Communicate(text, voice, rate="+10%").save(out_mp3)


def build_segment_audio(text, voice, duration, out_wav):
    mp3 = out_wav.replace(".wav", ".mp3")
    if str(text).strip():
        asyncio.run(tts(text, voice, mp3))
        subprocess.run(["ffmpeg", "-y", "-i", mp3, "-af", "apad",
                        "-t", f"{duration:.3f}", "-ar", "44100", "-ac", "2",
                        out_wav], check=True, capture_output=True)
    else:
        subprocess.run(["ffmpeg", "-y", "-f", "lavfi",
                        "-i", "anullsrc=r=44100:cl=stereo",
                        "-t", f"{duration:.3f}", out_wav],
                       check=True, capture_output=True)


# ---------------------------------------------------------------- main
def main():
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_KEY"]
    reel_id = os.environ["REEL_ID"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    r = requests.get(f"{url}/rest/v1/ig_reels",
                     params={"id": f"eq.{reel_id}", "select": "*"},
                     headers=headers, timeout=30)
    r.raise_for_status()
    rows = r.json()
    if not rows:
        sys.exit(f"Reel {reel_id} introuvable")
    row = rows[0]
    data = row["donnees"] if isinstance(row["donnees"], dict) else json.loads(row["donnees"])
    accent = hex_to_rgb(data.get("accent", "#7c3aed"))
    voice = data.get("voix", "fr-FR-RemyMultilingualNeural")

    requests.patch(f"{url}/rest/v1/ig_reels", params={"id": f"eq.{reel_id}"},
                   headers={**headers, "Content-Type": "application/json"},
                   json={"statut": "rendu_en_cours"}, timeout=30)

    shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(FRAMES)
    os.makedirs(AUDIO)
    os.makedirs(CACHE)

    grad = gradient_bg(accent)
    items = data["items"]
    total = len(items)

    # fonds : photo Pexels par item si dispo, sinon dégradé
    bgs = {}
    for idx, it in enumerate(items):
        photo = fetch_pexels_photo(it.get("image_query", ""), idx)
        bgs[idx] = photo if photo is not None else grad
    hook_bg = bgs.get(0, grad)

    segments = []
    segments.append((DUR_HOOK,
                     frames_hook(grad, data, accent, int(DUR_HOOK * FPS)),
                     f"{data['titre_ecran']}. {data['hook']}"))
    for idx in range(total - 1, 0, -1):
        it = items[idx]
        punch = it.get("punchline", "")
        dur = DUR_ITEM + (0.8 if punch else 0.0)
        segments.append((dur,
                         frames_item(bgs[idx], idx + 1, total, it, accent,
                                     int(dur * FPS)),
                         f"Numéro {idx + 1}. {it['label']}, {it['valeur']}. {punch}"))
    top1 = items[0]
    punch1 = top1.get("punchline", "")
    dur1 = DUR_TOP1 + (0.8 if punch1 else 0.0)
    segments.append((dur1,
                     frames_item(bgs[0], 1, total, top1, accent,
                                 int(dur1 * FPS), is_top1=True),
                     f"Et le numéro 1... {top1['label']} ! {top1['valeur']} ! {punch1}"))
    segments.append((DUR_OUTRO,
                     frames_outro(hook_bg, data, accent, int(DUR_OUTRO * FPS)),
                     data.get("cta", "")))

    n = 0
    wavs = []
    for si, (dur, frames, text) in enumerate(segments):
        for img in frames:
            img.save(f"{FRAMES}/f_{n:05d}.png")
            n += 1
        wav = f"{AUDIO}/seg_{si:02d}.wav"
        build_segment_audio(text, voice, dur, wav)
        wavs.append(wav)

    with open(f"{AUDIO}/list.txt", "w") as f:
        for w_ in wavs:
            f.write(f"file '{os.path.abspath(w_)}'\n")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0",
                    "-i", f"{AUDIO}/list.txt", f"{AUDIO}/voice.wav"],
                   check=True, capture_output=True)

    audio_final = f"{AUDIO}/voice.wav"
    if os.path.exists("assets/music.mp3"):
        subprocess.run(
            ["ffmpeg", "-y", "-i", f"{AUDIO}/voice.wav", "-stream_loop", "-1",
             "-i", "assets/music.mp3",
             "-filter_complex",
             "[1:a]volume=0.12[m];[0:a][m]amix=inputs=2:duration=first[a]",
             "-map", "[a]", f"{AUDIO}/mix.wav"],
            check=True, capture_output=True)
        audio_final = f"{AUDIO}/mix.wav"

    out = f"{WORK}/reel.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-framerate", str(FPS), "-i", f"{FRAMES}/f_%05d.png",
         "-i", audio_final, "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-preset", "medium", "-crf", "21", "-c:a", "aac", "-b:a", "160k",
         "-shortest", "-movflags", "+faststart", out],
        check=True, capture_output=True)

    with open(out, "rb") as f:
        up = requests.post(
            f"{url}/storage/v1/object/reels/{reel_id}.mp4",
            headers={**headers, "Content-Type": "video/mp4", "x-upsert": "true"},
            data=f.read(), timeout=120)
    up.raise_for_status()
    video_url = f"{url}/storage/v1/object/public/reels/{reel_id}.mp4"

    requests.patch(f"{url}/rest/v1/ig_reels", params={"id": f"eq.{reel_id}"},
                   headers={**headers, "Content-Type": "application/json"},
                   json={"statut": "video_prete", "video_url": video_url},
                   timeout=30)
    print(f"OK -> {video_url}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        try:
            url = os.environ["SUPABASE_URL"].rstrip("/")
            key = os.environ["SUPABASE_SERVICE_KEY"]
            requests.patch(
                f"{url}/rest/v1/ig_reels",
                params={"id": f"eq.{os.environ.get('REEL_ID', '')}"},
                headers={"apikey": key, "Authorization": f"Bearer {key}",
                         "Content-Type": "application/json"},
                json={"statut": "erreur", "erreur": str(e)[:500]}, timeout=30)
        except Exception:
            pass
        raise
