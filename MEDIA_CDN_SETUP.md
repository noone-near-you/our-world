# How to host music on a free CDN (step by step)

You do **not** need to put big music files in your main game GitHub repo.
Short voice clips (sfx) can stay in the game. Songs + ambient go on a free CDN.

This does **not** lower game quality. Same full-quality MP3s — they just load from another place.

---

## What is a CDN? (simple)

A **CDN** is a website that only stores and sends files fast (music, images).
Your game code stays on GitHub / your host.
When the player presses play, the phone downloads the song from the CDN, not from your code repo.

---

## Easiest free method: GitHub + jsDelivr

### Step 1 — Create a second GitHub repo (only media)

1. Go to https://github.com/new  
2. Name it something like `anniv-media`  
3. Make it **Public**  
4. Create the repo (no need to add a README)

### Step 2 — Upload your folders

On your computer, arrange files like this:

```
anniv-media/
  music/
    bedroom/
      Adore You.mp3
      Best Part.mp3
      ...
    kitchen/
      ...
    beach/
    pool/
    garden/
    shower/
  ambient/
    bedroom/
      ambient.mp3
    kitchen/
      ambient.mp3
    beach/
    pool/
    garden/
    shower/
```

Upload these folders to the `anniv-media` repo (GitHub website “Upload files”, or GitHub Desktop, or `git push`).

**Important:** folder names and song filenames must match what the game expects
(same as inside `phone/public/music/...` and `phone/public/ambient/...`).

### Step 3 — Get your CDN link

After the files are on GitHub, your CDN base is:

```
https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USERNAME/anniv-media@main
```

Replace `YOUR_GITHUB_USERNAME` with your real GitHub username.

Example for one song:

```
https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USERNAME/anniv-media@main/music/bedroom/Adore%20You.mp3
```

Open that in a browser — if the song plays, the CDN works.

### Step 4 — Tell the game to use the CDN

Open this file in your game project:

```
phone/src/audio/media.ts
```

Change:

```ts
export const MEDIA_BASE = '';
```

to:

```ts
export const MEDIA_BASE = 'https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USERNAME/anniv-media@main';
```

Save, rebuild / reload the game.

### Step 5 — What stays in the main game repo

Keep in the **game** repo:

- all code (`src/`)
- small SFX in `public/sfx/` (laughs, kiss, steps, etc.)

You can **remove** heavy folders from the game repo later (optional):

- `public/music/`
- `public/ambient/`

as long as `MEDIA_BASE` points to the media repo.

---

## Local testing (no CDN yet)

Leave:

```ts
export const MEDIA_BASE = '';
```

The game loads from `public/music` and `public/ambient` as before.

---

## Audio quality tips (still full quality for the player)

- Use **MP3 128–192 kbps** stereo — sounds great, much smaller than WAV  
- Do **not** use huge WAV files for songs in production  
- SFX can stay WAV/MP3 as they are now  

This is compression of *file size*, not “making the game look worse.”

---

## About phone heating

CDN does **not** fix heat by itself. Heat comes mostly from the 3D screen running every frame.

Safe improvements that do **not** reduce quality while you play:

1. Pause the game when you switch apps (screen off) — saves battery  
2. Don’t leave the game open in the background for hours  

If you want, we can add “pause when tab is hidden” in code next — invisible when you’re actually playing.

---

## Checklist

- [ ] Created public `anniv-media` GitHub repo  
- [ ] Uploaded `music/` and `ambient/` with correct names  
- [ ] Tested one song URL in the browser  
- [ ] Set `MEDIA_BASE` in `phone/src/audio/media.ts`  
- [ ] Reloaded the game and played a song  

Done.
