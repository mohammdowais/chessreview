# How to Add More Engine Models

This guide explains how to add new chess engine models (WebAssembly/JS) to the application.

## 1. Add the Engine Script
Place the engine's `.js` and `.wasm` files in the `public/` directory (e.g., `public/torch-engine.js`).

## 2. Update the UI
Modify `src/app/review/[gameId]/page.tsx` to include the new engine in the Settings modal:

```tsx
// Inside the Engine selection <select>
<option value="Torch 4 Lite (6MB download)">Torch 4 Lite (6MB download)</option>
<option value="New Engine Name">New Engine Name</option>
```

Update the `onChange` handler to set the correct script URL:

```tsx
onChange={(e) => {
    setEngineName(e.target.value);
    if (e.target.value === "New Engine Name") {
        setEngineUrl("/new-engine.js");
    } else {
        setEngineUrl("/stockfish.js");
    }
}}
```

## 3. Engine Customization (Optional)
If the new engine requires specific UCI options (like different parameter names), update the `ChessEngine` class in `src/lib/engine.ts`.
