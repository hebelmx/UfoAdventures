import re
from pathlib import Path

path = Path('src/js/engine/systems.ts')
text = path.read_text()

combo_pattern = re.compile(
    r"(        if \(transform\) {\n)\s*this\.game\.spawnEffect\?\(\{\n\s*position: \{ x: transform\.position\.x, y: transform\.position\.y \},\n\s*tint: 0xffaa33,\n\s*alpha: 0\.95,\n\s*lifeTime: 0\.4,\n\s*fade: 1\.2,\n\s*scale: 1\.2,\n\s*atlasAlias: 'vfx-atlas',\n\s*animation: 'comboBreaker',\n\s*animationSpeed: 0\.18\n\s*\}\);\n\s*}\n"
)

new_combo = (
    "        if (transform) {\n"
    "            this.game.spawnEffect?.({\n"
    "                position: { x: transform.position.x, y: transform.position.y },\n"
    "                tint: 0xffaa33,\n"
    "                alpha: 0.95,\n"
    "                lifeTime: 0.4,\n"
    "                fade: 1.2,\n"
    "                scale: 1.2,\n"
    "                atlasAlias: 'vfx-atlas',\n"
    "                animation: 'comboBreaker',\n"
    "                animationSpeed: 0.18,\n"
    "                loop: false\n"
    "            });\n"
    "        }\n"
)

text = combo_pattern.sub(new_combo, text, count=1)

origin_pattern = re.compile(
    r"(        this\.game\.spawnEffect\?\(\{\n)\s*position: origin,\n\s*tint: 0x66ccff,\n\s*alpha: 0\.7,\n\s*lifeTime: 0\.25,\n\s*fade: 1\.5,\n\s*scale: 0\.9,\n\s*atlasAlias: 'vfx-atlas',\n\s*animation: 'teleport-trail',\n\s*animationSpeed: 0\.24\n\s*\}\);\n"
)

new_origin = (
    "        this.game.spawnEffect?.({\n"
    "            position: origin,\n"
    "            tint: 0x66ccff,\n"
    "            alpha: 0.7,\n"
    "            lifeTime: 0.25,\n"
    "            fade: 1.5,\n"
    "            scale: 0.9,\n"
    "            atlasAlias: 'vfx-atlas',\n"
    "            animation: 'teleport-trail',\n"
    "            animationSpeed: 0.24,\n"
    "            loop: false\n"
    "        });\n"
)

text = origin_pattern.sub(new_origin, text, count=1)

arrive_pattern = re.compile(
    r"(        this\.game\.spawnEffect\?\(\{\n)\s*position: \{ x: transform\.position\.x, y: transform\.position\.y \},\n\s*tint: 0xffffff,\n\s*alpha: 0\.8,\n\s*lifeTime: 0\.3,\n\s*fade: 1\.8,\n\s*scale: 1\.0,\n\s*atlasAlias: 'vfx-atlas',\n\s*animation: 'teleport-arrive',\n\s*animationSpeed: 0\.2\n\s*\}\);\n"
)

new_arrive = (
    "        this.game.spawnEffect?.({\n"
    "            position: { x: transform.position.x, y: transform.position.y },\n"
    "            tint: 0xffffff,\n"
    "            alpha: 0.8,\n"
    "            lifeTime: 0.3,\n"
    "            fade: 1.8,\n"
    "            scale: 1.0,\n"
    "            atlasAlias: 'vfx-atlas',\n"
    "            animation: 'teleport-arrive',\n"
    "            animationSpeed: 0.2,\n"
    "            loop: false\n"
    "        });\n"
)

text = arrive_pattern.sub(new_arrive, text, count=1)

path.write_text(text)
