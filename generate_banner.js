const fs = require('fs');
const PNG = require('pngjs').PNG;

function createLogoPoints(type, n, w, h, ox, oy) {
    let pts = [];
    for(let i=0; i<n; i++) {
        let x, y;
        if(type === 'bracket') {
            if(Math.random() < 0.5) { // <
                y = 0.2 + Math.random()*0.6;
                x = y < 0.5 ? 0.4 - (y - 0.2) : 0.2 + (y - 0.5);
                x = 0.2 + x*0.4;
            } else { // >
                y = 0.2 + Math.random()*0.6;
                x = y < 0.5 ? 0.6 + (y - 0.2) : 0.8 - (y - 0.5);
                x = 0.4 + x*0.4;
            }
        } else if(type === 'circle') {
            let angle = Math.random() * Math.PI * 2;
            let r = 0.35 + (Math.random()-0.5)*0.04;
            x = 0.5 + r * Math.cos(angle);
            y = 0.5 + r * Math.sin(angle);
        } else if(type === 'triangle') {
            let r1 = Math.random(), r2 = Math.random();
            let sqr1 = Math.sqrt(r1);
            x = (1 - sqr1)*0.5 + sqr1*(1-r2)*0.2 + sqr1*r2*0.8;
            y = (1 - sqr1)*0.2 + sqr1*(1-r2)*0.8 + sqr1*r2*0.8;
            let edge = Math.floor(Math.random()*3);
            let t = Math.random();
            if(edge===0) { x = 0.2 + t*0.6; y=0.8; }
            else if(edge===1) { x=0.2+t*0.3; y=0.8-t*0.6; }
            else { x=0.5+t*0.3; y=0.2+t*0.6; }
        }
        pts.push({x: x*w + ox, y: y*h + oy});
    }
    // Sort by polar angle from centroid for smooth morphing
    let cx = ox + w/2, cy = oy + h/2;
    pts.sort((a,b) => Math.atan2(a.y-cy, a.x-cx) - Math.atan2(b.y-cy, b.x-cx));
    return pts;
}

function generateSvg(imagePath, isDark) {
    const bg = isDark ? "#0A101F" : "transparent";
    const dotsColor = isDark ? "#A78BFA" : "#7C3AED";
    const chrome = isDark ? "#22D3EE" : "#0891B2";
    const text = isDark ? "#94A3B8" : "#475569";
    
    const jpeg = require('jpeg-js');
    let buffer = fs.readFileSync(imagePath);
    let imgData = jpeg.decode(buffer, {useTArray: true});
    
    let portrait = [];
    
    // Sample to roughly 300x340
    let targetW = 300, targetH = 340;
    let stepX = imgData.width / targetW;
    let stepY = imgData.height / targetH;
    
    // True Floyd-Steinberg Dithering
    // First, convert the image to a grayscale luma array
    let lumaMap = new Float32Array(targetW * targetH);
    for(let y=0; y<targetH; y++) {
        for(let x=0; x<targetW; x++) {
            let srcX = Math.floor(x * stepX);
            let srcY = Math.floor(y * stepY);
            let idx = (imgData.width * srcY + srcX) << 2;
            let r = imgData.data[idx];
            let g = imgData.data[idx+1];
            let b = imgData.data[idx+2];
            
            // Grayscale
            let luma = (r*0.3 + g*0.59 + b*0.11);
            
            // Drop pure white/light backgrounds
            if (r > 230 && g > 230 && b > 230) {
                luma = isDark ? 0 : 255;
            } else {
                // Apply contrast
                luma = (luma - 128) * 1.3 + 128;
            }
            
            lumaMap[y * targetW + x] = luma;
        }
    }
    
    // Apply Floyd-Steinberg
    for(let y=0; y<targetH; y++) {
        for(let x=0; x<targetW; x++) {
            let oldPixel = lumaMap[y * targetW + x];
            let newPixel = oldPixel < 128 ? 0 : 255;
            lumaMap[y * targetW + x] = newPixel;
            let quantError = oldPixel - newPixel;
            
            if(x + 1 < targetW) lumaMap[y * targetW + x + 1] += quantError * 7 / 16;
            if(y + 1 < targetH) {
                if(x - 1 >= 0) lumaMap[(y + 1) * targetW + x - 1] += quantError * 3 / 16;
                lumaMap[(y + 1) * targetW + x] += quantError * 5 / 16;
                if(x + 1 < targetW) lumaMap[(y + 1) * targetW + x + 1] += quantError * 1 / 16;
            }
            
            let lit = isDark ? (newPixel === 255) : (newPixel === 0);
            
            // Only add if inside a rough ellipse to drop the background
            let dx = x - 150;
            let dy = y - 170;
            let isInside = Math.sqrt((dx*dx)/(140*140) + (dy*dy)/(160*160)) < 1.0;
            
            if(lit && isInside) {
                // Add slight sub-pixel noise to prevent blocky SMIL morphs
                let px = x * 1.5 + 40 + (Math.random()-0.5)*0.5;
                let py = y * 1.5 + 80 + (Math.random()-0.5)*0.5;
                portrait.push({x: px, y: py});
            }
        }
    }
    
    if(portrait.length > 17000) portrait.length = 17000;
    
    let nTravellers = 900;
    let travellers = [];
    if(portrait.length > nTravellers) {
        for(let i=0; i<nTravellers; i++) {
            let idx = Math.floor(Math.random() * portrait.length);
            travellers.push(portrait.splice(idx, 1)[0]);
        }
    } else {
        travellers = portrait;
        portrait = [];
    }
    
    let tx=0, ty=0;
    for(let p of travellers) { tx+=p.x; ty+=p.y; }
    tx/=travellers.length; ty/=travellers.length;
    travellers.sort((a,b) => Math.atan2(a.y-ty, a.x-tx) - Math.atan2(b.y-ty, b.x-tx));

    let lw=200, lh=200, lox=150, loy=150;
    let l1 = createLogoPoints('bracket', nTravellers, lw, lh, lox, loy);
    let l2 = createLogoPoints('circle', nTravellers, lw, lh, lox, loy);
    let l3 = createLogoPoints('triangle', nTravellers, lw, lh, lox, loy);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1180 610" width="100%" height="100%">\n`;
    if(bg !== "transparent") svg += `  <rect width="1180" height="610" fill="${bg}" />\n`;
    
    svg += `  <text x="40" y="40" fill="${chrome}" font-family="monospace" font-size="14">profile.sh --live</text>\n`;
    svg += `  <text x="40" y="60" fill="${chrome}" font-family="monospace" font-size="12">VISUAL.MAP</text>\n`;

    // pulsing red LIVE badge
    svg += `  <circle cx="190" cy="35" r="4" fill="#EF4444">\n`;
    svg += `    <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />\n`;
    svg += `  </circle>\n`;
    svg += `  <text x="200" y="40" fill="#EF4444" font-family="monospace" font-size="12" font-weight="bold">LIVE</text>\n`;
    
    // coloured pill with handle
    const accent = "#10B981"; // Green accent
    svg += `  <rect x="1000" y="24" width="130" height="24" rx="12" fill="${accent}" />\n`;
    svg += `  <text x="1065" y="40" fill="#0A101F" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">yashalshende</text>\n`;

    
    let cx = 600, cy = 80;
    const rows = [
        ["Subject", "Yashal Sharadrao Shende"],
        ["Role", "AI Engineer"],
        ["Origin", "India"],
        ["Status", "Building + Learning + Shipping"],
        ["ToolChain", "VS Code, Git, Docker, Node.js"],
        ["Core.Lang", "Python, JavaScript, TypeScript"],
        ["Core.Frontend", "React, Next.js, HTML/CSS"],
        ["Core.Backend", "Node.js, Express, Django"],
        ["Core.Database", "PostgreSQL, MongoDB"],
        ["Grid.GitHub", "github.com/yashalshende"],
        ["Grid.Email", "shendeyashal@gmail.com"]
    ];
    svg += `  <text x="${cx}" y="${cy}" fill="${chrome}" font-family="monospace" font-size="14" font-weight="bold">SYSTEM.INFO</text>\n`;
    cy += 30;
    for(let r of rows) {
        svg += `  <text x="${cx}" y="${cy}" fill="${chrome}" font-family="monospace" font-size="14">${r[0]}</text>\n`;
        let dots = ".".repeat(Math.max(1, 55 - r[0].length - r[1].length));
        svg += `  <text x="${cx+120}" y="${cy}" fill="${text}" font-family="monospace" font-size="14">${dots}</text>\n`;
        svg += `  <text x="${cx+540}" y="${cy}" fill="${text}" font-family="monospace" font-size="14" text-anchor="end">${r[1]}</text>\n`;
        cy += 35;
    }
    
    let portD = portrait.map(p => `M${p.x.toFixed(1)},${p.y.toFixed(1)} h1.5 v1.5 h-1.5 Z`).join(" ");
    svg += `  <path d="${portD}" fill="${dotsColor}" shape-rendering="crispEdges">\n`;
    svg += `    <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0; 0.2; 0.3; 0.9; 1" dur="14.2s" repeatCount="indefinite" />\n`;
    svg += `  </path>\n`;

    // Use <g> and animateTransform for much better cross-browser performance and reliability
    for(let i=0; i<nTravellers; i++) {
        let p0 = travellers[i], p1 = l1[i], p2 = l2[i], p3 = l3[i];
        let transVals = [
            `${p0.x.toFixed(1)},${p0.y.toFixed(1)}`,
            `${p0.x.toFixed(1)},${p0.y.toFixed(1)}`,
            `${p1.x.toFixed(1)},${p1.y.toFixed(1)}`,
            `${p1.x.toFixed(1)},${p1.y.toFixed(1)}`,
            `${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
            `${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
            `${p3.x.toFixed(1)},${p3.y.toFixed(1)}`,
            `${p3.x.toFixed(1)},${p3.y.toFixed(1)}`,
            `${p0.x.toFixed(1)},${p0.y.toFixed(1)}`
        ].join("; ");
        
        svg += `  <g>\n`;
        svg += `    <animateTransform attributeName="transform" type="translate" values="${transVals}" keyTimes="0; 0.2; 0.3; 0.45; 0.55; 0.7; 0.8; 0.9; 1" dur="14.2s" repeatCount="indefinite" />\n`;
        svg += `    <path d="M0,0 h1.5 v1.5 h-1.5 Z" fill="${dotsColor}" shape-rendering="crispEdges" />\n`;
        svg += `  </g>\n`;
    }
    
    svg += `</svg>`;
    
    let out = isDark ? "dark.svg" : "light.svg";
    fs.writeFileSync(out, svg);
    console.log("Generated " + out);
}

generateSvg('avatar.jpg', true);
generateSvg('avatar.jpg', false);
