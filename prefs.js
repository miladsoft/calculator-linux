import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class CalculatorLinuxPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('Calculator Linux'),
            icon_name: 'accessories-calculator-symbolic',
        });
        window.add(page);

        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Behavior'),
            description: _('Control how the calculator behaves in the panel and menu.'),
        });
        page.add(behaviorGroup);

        const panelDisplayRow = new Adw.ComboRow({
            title: _('Panel Display'),
            subtitle: _('What appears near the calculator icon in top panel'),
            model: Gtk.StringList.new([
                _('Icon only'),
                _('Last result'),
                _('Current expression'),
            ]),
            selected: settings.get_int('panel-display-mode'),
        });
        panelDisplayRow.connect('notify::selected', () =>
            settings.set_int('panel-display-mode', panelDisplayRow.selected));
        behaviorGroup.add(panelDisplayRow);

        const angleRow = new Adw.ComboRow({
            title: _('Angle Unit'),
            subtitle: _('Used for sin/cos/tan and inverse trig functions'),
            model: Gtk.StringList.new([
                _('Degrees'),
                _('Radians'),
            ]),
            selected: settings.get_boolean('use-degrees') ? 0 : 1,
        });
        angleRow.connect('notify::selected', () =>
            settings.set_boolean('use-degrees', angleRow.selected === 0));
        behaviorGroup.add(angleRow);

        const clearOnCloseRow = new Adw.SwitchRow({
            title: _('Clear Expression on Close'),
            subtitle: _('Reset input each time the popup closes'),
        });
        settings.bind('clear-on-close', clearOnCloseRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviorGroup.add(clearOnCloseRow);

        const copyResultRow = new Adw.SwitchRow({
            title: _('Copy Result to Clipboard'),
            subtitle: _('Automatically copy successful results'),
        });
        settings.bind('copy-result-to-clipboard', copyResultRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviorGroup.add(copyResultRow);

        const formattingGroup = new Adw.PreferencesGroup({
            title: _('Formatting & History'),
            description: _('Precision and number of saved history items.'),
        });
        page.add(formattingGroup);

        const decimalRow = new Adw.ActionRow({
            title: _('Decimal Places'),
            subtitle: _('Used when formatting non-integer results'),
        });
        const decimalSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 12,
                step_increment: 1,
                page_increment: 1,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        decimalSpin.set_value(settings.get_int('decimal-places'));
        decimalSpin.connect('value-changed', widget =>
            settings.set_int('decimal-places', widget.get_value_as_int()));
        decimalRow.add_suffix(decimalSpin);
        decimalRow.activatable_widget = decimalSpin;
        formattingGroup.add(decimalRow);

        const historyRow = new Adw.ActionRow({
            title: _('History Size'),
            subtitle: _('How many recent calculations are kept in the popup'),
        });
        const historySpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 50,
                step_increment: 1,
                page_increment: 5,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        historySpin.set_value(settings.get_int('history-size'));
        historySpin.connect('value-changed', widget =>
            settings.set_int('history-size', widget.get_value_as_int()));
        historyRow.add_suffix(historySpin);
        historyRow.activatable_widget = historySpin;
        formattingGroup.add(historyRow);

        window.set_default_size(620, 520);
    }
}
