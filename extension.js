import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {ExpressionEvaluator} from './src/evaluator.js';

const PANEL_DISPLAY_ICON = 0;
const PANEL_DISPLAY_RESULT = 1;
const PANEL_DISPLAY_EXPRESSION = 2;

const CalculatorIndicator = GObject.registerClass(
class CalculatorIndicator extends PanelMenu.Button {
    constructor(extension) {
        super(0.0, _('Calculator Linux'));

        this._extension = extension;
        this._settings = extension.getSettings();
        this._evaluator = new ExpressionEvaluator({
            angleUnit: this._settings.get_boolean('use-degrees') ? 'degrees' : 'radians',
        });

        this._history = [];
        this._lastResult = '';
        this._errorStyleClass = 'calculator-result-error';

        this._settingsSignals = [];
        this._registerSettingsSignals();

        this._buildPanelActor();
        this._buildMenu();
        this._syncFromSettings();
    }

    destroy() {
        for (const signalId of this._settingsSignals)
            this._settings.disconnect(signalId);
        this._settingsSignals = [];
        super.destroy();
    }

    _registerSettingsSignals() {
        const keys = [
            'panel-display-mode',
            'decimal-places',
            'history-size',
            'use-degrees',
            'copy-result-to-clipboard',
            'clear-on-close',
        ];

        for (const key of keys) {
            const signalId = this._settings.connect(`changed::${key}`, () => this._syncFromSettings());
            this._settingsSignals.push(signalId);
        }
    }

    _syncFromSettings() {
        this._evaluator.setAngleUnit(this._settings.get_boolean('use-degrees') ? 'degrees' : 'radians');

        const historySize = this._settings.get_int('history-size');
        this._history = this._history.slice(0, Math.max(1, historySize));
        this._renderHistory();
        this._updatePanelLabel();
    }

    _buildPanelActor() {
        this._panelBox = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._icon = new St.Icon({
            icon_name: 'accessories-calculator-symbolic',
            style_class: 'system-status-icon',
        });

        this._panelLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'calculator-panel-label',
        });

        this._panelBox.add_child(this._icon);
        this._panelBox.add_child(this._panelLabel);
        this.add_child(this._panelBox);
    }

    _buildMenu() {
        this.menu.box.add_style_class_name('calculator-menu');

        const entryItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'calculator-entry-item',
        });
        this._entry = new St.Entry({
            hint_text: _('Type expression, e.g. (3+2)^2'),
            style_class: 'calculator-entry',
            can_focus: true,
            x_expand: true,
        });
        entryItem.add_child(this._entry);
        this.menu.addMenuItem(entryItem);

        const resultItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'calculator-result-item',
        });
        this._resultLabel = new St.Label({
            text: _('Result: -'),
            x_expand: true,
            x_align: Clutter.ActorAlign.END,
            style_class: 'calculator-result-label',
        });
        resultItem.add_child(this._resultLabel);
        this.menu.addMenuItem(resultItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const gridLayout = new Clutter.GridLayout({
            column_spacing: 6,
            row_spacing: 6,
            column_homogeneous: true,
            row_homogeneous: true,
        });

        const buttonGrid = new St.Widget({
            style_class: 'calculator-grid',
            layout_manager: gridLayout,
            x_expand: true,
            y_expand: true,
        });

        const rows = [
            ['(', ')', 'C', '⌫'],
            ['sin', 'cos', 'tan', '^'],
            ['7', '8', '9', '/'],
            ['4', '5', '6', '*'],
            ['1', '2', '3', '-'],
            ['0', '.', 'pi', '+'],
            ['sqrt', 'ln', 'log', '='],
        ];

        rows.forEach((cols, rowIndex) => {
            cols.forEach((label, colIndex) => {
                const button = new St.Button({
                    label,
                    style_class: label === '=' ? 'calculator-button calculator-button-primary' : 'calculator-button',
                    x_expand: true,
                    y_expand: true,
                    can_focus: true,
                });
                button.connect('clicked', () => this._onButtonPressed(label));
                gridLayout.attach(button, colIndex, rowIndex, 1, 1);
            });
        });

        const gridItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'calculator-grid-item',
        });
        gridItem.add_child(buttonGrid);
        this.menu.addMenuItem(gridItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const historyTitleItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'calculator-history-title-item',
        });
        this._historyTitle = new St.Label({
            text: _('History'),
            x_expand: true,
            style_class: 'calculator-history-title',
        });
        historyTitleItem.add_child(this._historyTitle);
        this.menu.addMenuItem(historyTitleItem);

        this._historySection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._historySection);

        this.menu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen) {
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    this._entry.grab_key_focus();
                    return GLib.SOURCE_REMOVE;
                });
                return;
            }

            if (this._settings.get_boolean('clear-on-close'))
                this._clearExpression();
        });

        this._entry.clutter_text.connect('activate', () => this._evaluateExpression());
        this._entry.clutter_text.connect('text-changed', () => this._updatePanelLabel());
        this._entry.clutter_text.connect('key-press-event', (_actor, event) => {
            const symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Escape) {
                this._clearExpression();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _onButtonPressed(label) {
        if (label === '=') {
            this._evaluateExpression();
            return;
        }

        if (label === 'C') {
            this._clearExpression();
            return;
        }

        if (label === '⌫') {
            this._backspace();
            return;
        }

        if (['sin', 'cos', 'tan', 'sqrt', 'ln', 'log'].includes(label)) {
            this._appendText(`${label}(`);
            return;
        }

        this._appendText(label);
    }

    _appendText(text) {
        const current = this._entry.get_text();
        this._entry.set_text(`${current}${text}`);
        this._entry.clutter_text.set_cursor_position(-1);
        this._updatePanelLabel();
    }

    _backspace() {
        const current = this._entry.get_text();
        if (!current)
            return;
        this._entry.set_text(current.substring(0, current.length - 1));
        this._entry.clutter_text.set_cursor_position(-1);
        this._updatePanelLabel();
    }

    _clearExpression() {
        this._entry.set_text('');
        this._resultLabel.set_text(_('Result: -'));
        this._resultLabel.remove_style_class_name(this._errorStyleClass);
        this._updatePanelLabel();
    }

    _evaluateExpression() {
        const expression = this._entry.get_text().trim();
        if (!expression)
            return;

        try {
            const result = this._evaluator.evaluate(expression);
            const decimalPlaces = this._settings.get_int('decimal-places');
            const formatted = this._evaluator.format(result, decimalPlaces);

            this._lastResult = formatted;
            this._resultLabel.set_text(`${_('Result')}: ${formatted}`);
            this._resultLabel.remove_style_class_name(this._errorStyleClass);
            this._pushHistory(expression, formatted);

            if (this._settings.get_boolean('copy-result-to-clipboard')) {
                St.Clipboard.get_default().set_text(
                    St.ClipboardType.CLIPBOARD,
                    formatted
                );
            }

            this._updatePanelLabel();
        } catch (error) {
            this._resultLabel.set_text(`${_('Error')}: ${error.message}`);
            this._resultLabel.add_style_class_name(this._errorStyleClass);
        }
    }

    _pushHistory(expression, result) {
        this._history.unshift({expression, result});
        const historySize = this._settings.get_int('history-size');
        this._history = this._history.slice(0, Math.max(1, historySize));
        this._renderHistory();
    }

    _renderHistory() {
        this._historySection.removeAll();

        if (this._history.length === 0) {
            const emptyItem = new PopupMenu.PopupMenuItem(_('No history yet'), {
                reactive: false,
                can_focus: false,
            });
            emptyItem.add_style_class_name('calculator-history-empty');
            this._historySection.addMenuItem(emptyItem);
            return;
        }

        for (const item of this._history) {
            const historyItem = new PopupMenu.PopupMenuItem(`${item.expression} = ${item.result}`);
            historyItem.connect('activate', () => {
                this._entry.set_text(item.expression);
                this._entry.clutter_text.set_cursor_position(-1);
                this._updatePanelLabel();
            });
            this._historySection.addMenuItem(historyItem);
        }
    }

    _updatePanelLabel() {
        const mode = this._settings.get_int('panel-display-mode');
        let text = '';

        if (mode === PANEL_DISPLAY_RESULT)
            text = this._lastResult;
        else if (mode === PANEL_DISPLAY_EXPRESSION)
            text = this._entry.get_text();

        const hasText = text.length > 0;
        this._panelLabel.set_text(hasText ? ` ${text}` : '');
        this._panelLabel.visible = mode !== PANEL_DISPLAY_ICON && hasText;
    }
});

export default class CalculatorLinuxExtension extends Extension {
    enable() {
        this._indicator = new CalculatorIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
