/**
 * Generate images based on a YouTube URL suitable for easily sharing
 *
 * # Created
 * Author: Dave Eddy <ysap@daveeddy.com>
 * Date: February 03, 2026
 * License: MIT
 *
 * # Contributors
 * - Dave Eddy <ysap@daveeddy.com>
 */

const font = 'Fira Mono';
let lastVideoId = null;
let errorDiv;
let isDebug = false;

// Main Method
function main() {
    window.addEventListener('load', () => {
        isDebug = new URLSearchParams(window.location.search).has('debug');

        document.getElementById('url-form').addEventListener('submit', event => generate(event));
        document.getElementById('downloadBtn').addEventListener('click', downloadAll);

        // Create error display
        errorDiv = document.createElement('div');
        errorDiv.id = 'error';
        errorDiv.style.display = 'none';
        errorDiv.style.color = 'red';
        errorDiv.style.margin = '10px 0';
        document.getElementById('container').insertBefore(errorDiv, document.getElementById('output'));
    });
}

// Display error in UI
function showError(message) {
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    } else {
        alert(message);
    }
    console.error(message);
}

function videoIdToThumbnail(videoId, quality) {
    return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

function shortUrl(videoId) {
    return `https://youtu.be/${videoId}`;
}

// helper to calculate text wrap
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
        const testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > maxWidth) {
            lines.push(line.trim());
            line = word + ' ';
        } else {
            line = testLine;
        }
    }
    if (line) {
        lines.push(line.trim());
    }
    return lines;
}

// extract the ID portion of a youtube URL
function getYouTubeID(url) {
    try {
        const parsed = new URL(url);
        if (parsed.hostname === 'youtu.be') {
            return parsed.pathname.slice(1);
        }
        if (parsed.hostname.includes('youtube.com')) {
            return parsed.searchParams.get('v');
        }
    } catch (e) {
        showError('Invalid URL format');
        return null;
    }
    showError('Failed to extract YouTube ID from URL');
    return null;
}

// download all button clicked
function downloadAll() {
    if (!lastVideoId) {
        return;
    }

    const output = document.getElementById('output');
    Array.from(output.children).forEach((a, i) => {
        setTimeout(() => {
            if (isDebug) {
                console.log('clicking');
                console.log(a);
            }
            a.click();
        }, i * 100);
    });
}

// generate button
async function generate(event) {
    // prevent page reload
    event.preventDefault();

    const urlInput = document.getElementById('url-input');
    const url = urlInput?.value?.trim();
    if (!url) {
        showError('Please enter a YouTube URL');
        return;
    }

    const videoId = getYouTubeID(url);
    if (!videoId) {
        return;
    }

    // Hide previous error and disable button
    if (errorDiv) errorDiv.style.display = 'none';
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating...';

    try {
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        if (!res.ok) {
            new Error(`Failed to fetch video info: ${res.status}`);
        }
        const data = await res.json();
        process(data, videoId);
    } catch (err) {
        showError(`Error fetching video info: ${err.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate Images';
    }
}

function process(data, videoId) {
    if (!data.title || !data.author_name || !data.url) {
        showError('Invalid video or missing data');
        return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const qualities = ['maxresdefault', 'hqdefault', 'mqdefault', 'default'];
    let qualityIndex = 0;

    function tryNextQuality() {
        if (qualityIndex >= qualities.length) {
            showError('Failed to load thumbnail');
            return;
        }
        img.src = videoIdToThumbnail(videoId, qualities[qualityIndex]);
        qualityIndex++;
    }

    img.onload = function() {
        lastVideoId = videoId;
        drawImages(img, data, videoId);
        document.getElementById('downloadBtn').style.display = 'inline-block';
    };

    img.onerror = tryNextQuality;

    tryNextQuality();
}

function base64img(name, canvas) {
    const data = canvas.toDataURL('image/jpeg');
    const a = document.createElement('a');
    a.download = name;
    a.href = data;

    const out = new Image();
    out.src = data;
    out.classList.add('generated');

    a.appendChild(out);
    return a;
}

function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return { canvas, ctx };
}

function drawHeadline(ctx, canvas, headline, x, y) {
    ctx.font = `110px ${font}`;
    ctx.fillStyle = "#eee";
    ctx.textAlign = "center";
    ctx.fillText(headline, x, y);

    const textMetrics = ctx.measureText(headline);
    const padding = 50;
    const radiusX = textMetrics.width / 2 + padding;
    const radiusY = 110;

    ctx.strokeStyle = "#f00";
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.ellipse(x, y - 40, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
}

function drawTitleAndAuthor(ctx, data, startY, maxWidth = 1240) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#eee";
    ctx.font = `56px ${font}`;
    const lines = wrapText(ctx, data.title, maxWidth);
    lines.forEach((line, i) => {
        ctx.fillText(line, 20, startY + i * 56);
    });

    ctx.fillStyle = "#aaa";
    ctx.font = `28px ${font}`;
    ctx.fillText(`YouTube: ${data.author_name}`, 20, startY + lines.length * 58 - 20);
    return lines.length;
}

function drawImages(img, data, videoId) {
    // clear any existing images
    const output = document.getElementById('output');
    output.innerHTML = '';

    if (isDebug) {
        console.log(data);
    }

    // draw every image
    const funcs = [
        drawBasicImage,
        drawLargeImage,
        drawFullImage,
        drawBlurredImage,
    ];
    for (const func of funcs) {
        func(output, img, data, videoId);
    }
}

// -------- image drawing functions

function drawFullImage(output, img, data, videoId) {
    const { canvas, ctx } = createCanvas(1280, 1450);

    // Shadow for image
    ctx.shadowColor = '#000';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 15;

    const imgY = (canvas.height - 720) / 2;
    ctx.drawImage(img, 0, imgY, 1280, 720);
    ctx.shadowBlur = 0; // reset shadow

    // Headline
    const headline = 'Full Video on YouTube';
    drawHeadline(ctx, canvas, headline, canvas.width / 2, 170);

    // Title and author
    const titleLines = drawTitleAndAuthor(ctx, data, 1100);

    // URL
    const urlText = shortUrl(videoId);
    ctx.fillStyle = "#fff";
    ctx.font = `80px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(urlText, 1280 / 2, 1100 + titleLines * 58 + 110);

    const a = base64img(`${videoId}-full-image.jpg`, canvas);
    output.appendChild(a);
}

function drawLargeImage(output, img, data, videoId) {
    const { canvas, ctx } = createCanvas(1280, 1280);

    const imgY = (canvas.height - 720) / 2;
    ctx.drawImage(img, 0, imgY, 1280, 720);

    // Headline
    const headline = 'Full Video on YouTube';
    drawHeadline(ctx, canvas, headline, canvas.width / 2, 170);

    // Title and author
    drawTitleAndAuthor(ctx, data, 1100);

    const a = base64img(`${videoId}-large-image.jpg`, canvas);
    output.appendChild(a);
}

function drawBasicImage(output, img, data, videoId) {
    const { canvas, ctx } = createCanvas(1280, 900);

    // draw the original thumbnail
    ctx.drawImage(img, 0, 0, 1280, 720);

    // Title and author
    const padding = 20;
    drawTitleAndAuthor(ctx, data, 780, 1280 - padding * 2);

    const a = base64img(`${videoId}-basic-image.jpg`, canvas);
    output.appendChild(a);
}

function drawBlurredImage(output, img, data, videoId) {
    const { canvas, ctx } = createCanvas(1280, 720);

    // Fill black background
    ctx.fillStyle = "rgba(0, 0, 0, 1.0)";
    ctx.fillRect(0, 0, 1280, 720);

    // Blur the thumbnail
    ctx.filter = "blur(10px)";
    ctx.drawImage(img, 0, 0, 1280, 720);
    ctx.filter = "none";

    // Overlay dark
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, 1280, 720);

    // URL text
    const urlText = shortUrl(videoId);
    ctx.fillStyle = "#fff";
    ctx.font = `80px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(urlText, 1280 / 2, 720 / 2);

    const a = base64img(`${videoId}-blurred-image.jpg`, canvas);
    output.appendChild(a);
}

// Bootstrapping the Application
main();
