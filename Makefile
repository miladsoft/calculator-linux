UUID := calculator-linux@miladsoft.github.io
DATA_HOME := $(if $(XDG_DATA_HOME),$(XDG_DATA_HOME),$(HOME)/.local/share)
EXT_DIR := $(DATA_HOME)/gnome-shell/extensions/$(UUID)

.PHONY: install schema enable disable prefs zip uninstall

install:
	mkdir -p "$(EXT_DIR)"
	rsync -a --delete ./ "$(EXT_DIR)/" \
		--exclude .git --exclude .gitignore
	$(MAKE) schema

schema:
	glib-compile-schemas "$(EXT_DIR)/schemas"

enable:
	gnome-extensions enable "$(UUID)"

disable:
	gnome-extensions disable "$(UUID)"

prefs:
	gnome-extensions prefs "$(UUID)"

zip:
	gnome-extensions pack \
		--force \
		--extra-source=src/evaluator.js \
		--extra-source=prefs.js \
		--extra-source=stylesheet.css \
		--extra-source=schemas/org.gnome.shell.extensions.calculator-linux.gschema.xml

uninstall:
	gnome-extensions disable "$(UUID)" || true
	rm -rf "$(EXT_DIR)"
