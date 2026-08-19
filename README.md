# Brand New Frame

A static pixel-art photo framer. No application backend or build step is required.

## Features

- Exact supplied frame artwork
- Local image upload
- Mouse and touch positioning
- Wheel and pinch zoom
- Fit / cover modes
- Rotation controls
- Preview screen
- High-resolution PNG export
- Responsive mobile layout
- Creator watermark
- Privacy policy page

## Run locally

Open `index.html` directly, or serve the directory with any static HTTP server.

## Deploy

The project is a static site and can be deployed to Vercel, Netlify, GitHub Pages, or another static host.

For Vercel CLI:

```bash
vercel --prod
```

## Privacy

See [`privacy.html`](privacy.html) for the current privacy policy.

The editor processes selected images locally in the browser and does not upload them to a Brand New Frame backend. The site currently loads the Press Start 2P font from Google Fonts; see the privacy policy for details about that third-party request.

## GitHub

The repository can be published with standard Git commands:

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/brand-new-frame.git
git push -u origin main
```

Do not commit `.vercel/` or private credentials.
