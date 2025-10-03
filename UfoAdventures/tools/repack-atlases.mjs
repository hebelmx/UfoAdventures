import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = path.resolve(".");

const atlasPlans = [
    {
        name: "player-atlas",
        baseDir: "src/images/Sprites/Hero",
        animations: {
            idle: "player-atlas-idle.json",
            thrust: "player-atlas-thrust.json",
            teleport: "player-atlas-teleport.json",
            comboBreaker: "player-atlas-comboBreaker.json"
        }
    },
    {
        name: "blade-atlas",
        baseDir: "src/images/Sprites/Enemies/Blade",
        animations: {
            idle: "blade-atlas-idle.json",
            strafe: "blade-atlas-strafe.json",
            hit: "blade-atlas-hit.json",
            death: "blade-atlas-death.json"
        }
    },
    {
        name: "amidogus-atlas",
        baseDir: "src/images/Sprites/Enemies/Amidogus",
        animations: {
            idle: "amidogus-atlas-idle.json",
            strafe: "amidogus-atlas-strafe.json",
            hit: "amidogus-atlas-hit.json",
            death: "amidogus-atlas-death.json"
        }
    },
    {
        name: "vfx-atlas",
        baseDir: "src/images/Sprites/VFX",
        animations: {
            "beam-attack": "vfx-atlas-beam_attack.json",
            "boss-summon": "vfx-atlas-boss-summon.json",
            "bullet-impact": "vfx-atlas-bullet-impact.json",
            comboBreaker: "vfx-atlas-comboBreaker.json",
            "teleport-arrive": "vfx-atlas-teleport-arrive.json",
            "teleport-trail": "vfx-atlas-teleport-trail.json"
        }
    }
];

const padding = 2;
const sheetWidth = 4096;

function toPowerOfTwo(value) {
    let power = 1;
    while (power < value) {
        power *= 2;
    }
    return power;
}

async function extractFrames(plan) {
    const frames = [];
    const animations = {};

    for (const [animationName, fileName] of Object.entries(plan.animations)) {
        const manifestPath = path.resolve(root, plan.baseDir, fileName);
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Missing manifest ${manifestPath}`);
        }
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        const imageFile = manifest.meta?.image || fileName.replace(/\.json$/, ".png");
        const imagePath = path.resolve(path.dirname(manifestPath), imageFile);
        if (!fs.existsSync(imagePath)) {
            throw new Error(`Missing image ${imagePath}`);
        }
        const frameEntries = manifest.frames || {};
        const frameNames = Object.keys(frameEntries).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        animations[animationName] = frameNames.slice();

        for (const frameName of frameNames) {
            const entry = frameEntries[frameName];
            const { x, y, w, h } = entry.frame;
            const { data, info } = await sharp(imagePath, { failOn: "none" })
                .extract({ left: x, top: y, width: w, height: h })
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const { width, height, channels } = info;
            let minX = width;
            let minY = height;
            let maxX = -1;
            let maxY = -1;

            for (let yy = 0; yy < height; yy++) {
                for (let xx = 0; xx < width; xx++) {
                    const alpha = data[(yy * width + xx) * channels + 3];
                    if (alpha > 0) {
                        if (xx < minX) minX = xx;
                        if (yy < minY) minY = yy;
                        if (xx > maxX) maxX = xx;
                        if (yy > maxY) maxY = yy;
                    }
                }
            }

            let trimmedWidth = width;
            let trimmedHeight = height;
            let offsetX = 0;
            let offsetY = 0;
            let compositeBuffer;
            let trimmed = false;

            if (maxX >= minX && maxY >= minY) {
                trimmedWidth = maxX - minX + 1;
                trimmedHeight = maxY - minY + 1;
                offsetX = minX;
                offsetY = minY;
                trimmed = trimmedWidth !== width || trimmedHeight !== height;

                compositeBuffer = await sharp(data, {
                    raw: { width, height, channels }
                })
                    .extract({ left: minX, top: minY, width: trimmedWidth, height: trimmedHeight })
                    .png()
                    .toBuffer();
            } else {
                // Entire frame transparent; keep 1x1 pixel transparent placeholder
                trimmedWidth = 1;
                trimmedHeight = 1;
                trimmed = true;
                compositeBuffer = await sharp({
                    create: {
                        width: 1,
                        height: 1,
                        channels: 4,
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    }
                })
                    .png()
                    .toBuffer();
            }

            frames.push({
                name: frameName,
                animation: animationName,
                width: trimmedWidth,
                height: trimmedHeight,
                offsetX,
                offsetY,
                sourceWidth: width,
                sourceHeight: height,
                trimmed,
                buffer: compositeBuffer
            });
        }
    }

    return { frames, animations };
}

function layout(frames) {
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    let maxWidth = 0;

    frames.forEach(frame => {
        if (x + frame.width > sheetWidth) {
            x = 0;
            y += rowHeight + padding;
            rowHeight = 0;
        }
        frame.x = x;
        frame.y = y;
        x += frame.width + padding;
        rowHeight = Math.max(rowHeight, frame.height);
        maxWidth = Math.max(maxWidth, x);
    });

    const height = y + rowHeight;
    return {
        width: Math.min(sheetWidth, Math.max(1, Math.ceil(maxWidth))),
        height: Math.max(1, Math.ceil(height))
    };
}

async function buildAtlas(plan) {
    const { frames, animations } = await extractFrames(plan);
    frames.sort((a, b) => b.height - a.height);
    const { width, height } = layout(frames);
    const atlasWidth = Math.min(sheetWidth, toPowerOfTwo(width));
    const atlasHeight = toPowerOfTwo(height);

    if (atlasHeight > 4096) {
        console.warn(`Warning: ${plan.name} atlas height ${atlasHeight} exceeds 4096; consider revisiting sprite trims.`);
    }

    const canvas = sharp({
        create: {
            width: atlasWidth,
            height: atlasHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    });

    const composites = frames.map(frame => ({
        input: frame.buffer,
        left: frame.x,
        top: frame.y
    }));

    const outputDir = path.resolve(root, plan.baseDir);
    const outputImagePath = path.resolve(outputDir, `${plan.name}.png`);
    const outputJsonPath = path.resolve(outputDir, `${plan.name}.json`);

    await canvas.composite(composites).png().toFile(outputImagePath);

    const frameMap = {};
    frames.forEach(frame => {
        frameMap[frame.name] = {
            frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height },
            rotated: false,
            trimmed: frame.trimmed,
            spriteSourceSize: { x: frame.offsetX, y: frame.offsetY, w: frame.width, h: frame.height },
            sourceSize: { w: frame.sourceWidth, h: frame.sourceHeight },
            anchor: { x: 0.5, y: 0.5 }
        };
    });

    const manifest = {
        frames: frameMap,
        animations,
        meta: {
            app: "atlas-repacker",
            version: "1.0",
            image: path.basename(outputImagePath),
            size: { w: atlasWidth, h: atlasHeight },
            scale: 1,
            alias: plan.name
        }
    };

    fs.writeFileSync(outputJsonPath, JSON.stringify(manifest, null, 2));
    console.log(`Generated ${outputImagePath} (${atlasWidth}x${atlasHeight}) with ${frames.length} frames`);
}

(async () => {
    for (const plan of atlasPlans) {
        await buildAtlas(plan);
    }
})();
