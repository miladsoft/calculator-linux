# Calculator Linux (GNOME Extension)

A professional calculator extension for GNOME Shell available in the top panel, with a full preferences page.

## Features
- Top-panel calculator with a quick interface and built-in keyboard
- Supports mathematical expressions:
  - `+ - * / % ^`
  - Parentheses
  - Functions: `sin cos tan asin acos atan sqrt abs ln log floor ceil round`
  - Constants: `pi` and `e`
- Calculation history
- Configurable preferences:
  - Panel display mode (`Icon only` / `Last result` / `Current expression`)
  - Decimal places
  - History size
  - Degrees / Radians
  - Auto-copy result to clipboard
  - Clear expression on menu close

## Project Structure
- `metadata.json`
- `extension.js`
- `prefs.js`
- `stylesheet.css`
- `src/evaluator.js`
- `schemas/org.gnome.shell.extensions.calculator-linux.gschema.xml`

## Local Install (Developer Install)
> These instructions are for Linux with GNOME Shell.

Quickest way:
```bash
make install
make enable
```

Or manually:

1. Set the extension UUID:
```bash
UUID="calculator-linux@miladsoft.github.io"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
```

2. Copy files to the user extensions directory:
```bash
mkdir -p "$DATA_HOME/gnome-shell/extensions/$UUID"
rsync -a --delete ./ "$DATA_HOME/gnome-shell/extensions/$UUID/"
```

3. Compile GSettings schema:
```bash
glib-compile-schemas "$DATA_HOME/gnome-shell/extensions/$UUID/schemas"
```

4. Reload Shell:
- On X11: press `Alt+F2`, type `r`, then press Enter
- On Wayland: log out and log back in

5. Enable the extension:
```bash
gnome-extensions enable $UUID
```

## Open Preferences
```bash
gnome-extensions prefs calculator-linux@miladsoft.github.io
```

## Package for Distribution (ZIP)
From the project root:
```bash
gnome-extensions pack \
  --force \
  --extra-source=src/evaluator.js \
  --extra-source=stylesheet.css \
  --extra-source=prefs.js \
  --extra-source=schemas/org.gnome.shell.extensions.calculator-linux.gschema.xml
```

The output zip file can be installed with `gnome-extensions install` or through the Extensions UI.
