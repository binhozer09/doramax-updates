import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

CHANNEL_ID = "UCVRGRH2goft4HQ6fWkq-j7g"
FEED_URL = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
OUTPUT = "videos.json"

request = urllib.request.Request(FEED_URL, headers={"User-Agent": "DORAMAX-video-feed/1.0"})
with urllib.request.urlopen(request, timeout=30) as response:
    xml_data = response.read()

root = ET.fromstring(xml_data)
ns = {"yt": "http://www.youtube.com/xml/schemas/2015", "atom": "http://www.w3.org/2005/Atom"}
incoming = []
for entry in root.findall("atom:entry", ns):
    video_id = entry.findtext("yt:videoId", default="", namespaces=ns)
    title = entry.findtext("atom:title", default="Vídeo novo", namespaces=ns)
    published = entry.findtext("atom:published", default="", namespaces=ns)
    if video_id:
        incoming.append({"id": video_id, "title": title, "published": published})

if not incoming:
    raise SystemExit("Feed do YouTube vazio; catálogo anterior preservado.")

try:
    with open(OUTPUT, "r", encoding="utf-8") as file:
        current = json.load(file)
except (FileNotFoundError, json.JSONDecodeError):
    current = {"channelId": CHANNEL_ID, "videos": []}

# Compatibilidade com o catálogo antigo, que era uma lista simples.
if isinstance(current, list):
    current = {"channelId": CHANNEL_ID, "videos": current}
current_videos = current.get("videos", []) if isinstance(current, dict) else []

merged = {}
for video in incoming + current_videos:
    video_id = video.get("id")
    if video_id and video_id not in merged:
        merged[video_id] = {
            "id": video_id,
            "title": video.get("title") or "Vídeo novo",
            "published": video.get("published") or "",
        }

newest = [v for v in merged.values() if v.get("published")]
older = [v for v in merged.values() if not v.get("published")]
newest.sort(key=lambda v: v["published"], reverse=True)
result = {
    "channelId": CHANNEL_ID,
    "updatedAt": datetime.now(timezone.utc).isoformat(),
    "videos": (newest + older)[:300],
}
with open(OUTPUT, "w", encoding="utf-8") as file:
    json.dump(result, file, ensure_ascii=False, indent=2)
    file.write("\n")

print(f"Catálogo público atualizado: {len(result['videos'])} vídeos; {len(incoming)} recebidos do YouTube.")
