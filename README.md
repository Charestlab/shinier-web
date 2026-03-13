# SHINIER — CIE xyY Viewer

This repository contains a small Vite + React + TypeScript app that renders an interactive
Rösch–MacAdam / CIE xyY viewer.

## Run locally

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build
```

The production output is generated in `dist/`.

## Publish on GitHub Pages

This project is configured for static hosting on GitHub Pages.

### 1. Create a GitHub repository

Create an empty repository on GitHub, for example `shinier-site`.

### 2. Push this project

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

### 3. Add the workflow in this project

The file `.github/workflows/deploy.yml` builds the Vite app and publishes `dist/` to GitHub Pages.

### 4. Enable GitHub Pages

On GitHub:

- open the repository
- go to **Settings** → **Pages**
- set **Source** to **GitHub Actions**

### 5. Automatic deployment

Each push to `main` will rebuild and redeploy the website.

Your site URL will be:

```text
https://<your-user>.github.io/<your-repo>/
```
