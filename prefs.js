/*
/* Copyright (C) 2012 
 * Aleksandr Starun <aleksandr.starun@gmail.com>, 
 * Dmitriy Kostiuk <dmitriykostiuk@gmail.com>
 * Licence: GPLv2+
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this extension; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 * 
 * * Some parts of this code were forked from system-monitor:
 *   https://extensions.gnome.org/extension/120/system-monitor/
 */
 
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const N_ = function(e) { return e; };

let extension = imports.misc.extensionUtils.getCurrentExtension();
let convenience = extension.imports.convenience;

let Schema;

function init() {
    convenience.initTranslations();
    Schema = convenience.getSettings();	
}

String.prototype.capitalize = function(){
   return this.replace( /(^|\s)([a-z])/g , function(m,p1,p2){ return p1+p2.toUpperCase(); } );
};

const IntSelect = new Lang.Class({
	Name: 'WinThumbnails.IntSelect',

    _init: function(name) {
        this.label = new Gtk.Label({label: name + ":", xalign: 0});
        this.spin = new Gtk.SpinButton();
        this.actor = new Gtk.HBox();
        this.actor.add(this.label);
        this.actor.add(this.spin);
        this.spin.set_numeric(true);
    },
    set_args: function(minv, maxv, incre, page){
        this.spin.set_range(minv, maxv);
        this.spin.set_increments(incre, page);
    },
    set_value: function(value){
        this.spin.set_value(value);
    }
});

const Select = new Lang.Class({
	Name: 'WinThumbnails.Select',

    _init: function(name) {
        this.label = new Gtk.Label({label: name + ":", xalign: 0});
        this.selector = new Gtk.ComboBoxText();
        this.actor = new Gtk.HBox();
        this.actor.add(this.label);
        this.actor.add(this.selector);
    },
    set_value: function(value){
        this.selector.set_active(value);
    },
    add: function(items){   
        items.forEach(Lang.bind(this, function(item){
            this.selector.append_text(item);
        }));
    }
});

function set_enum(combo, schema, name){
    Schema.set_enum(name, combo.get_active());
}

function set_string(combo, schema, name, _slist){
    Schema.set_string(name, _slist[combo.get_active()]);
}

const App = new Lang.Class({
	Name: 'WinThumbnails.App',

    _init: function(){
        let keys = Schema.list_keys();
    
        this.items = [];
        this.settings = [];
    
        this.main_vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                       spacing: 10,
                                       border_width: 10});
        this.vert_set_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                                         spacing: 5,
                                         border_width: 10});
        this.main_vbox.pack_start(this.vert_set_box, true, false, 0);
    
        keys.forEach(Lang.bind(this, function(key){
            if (key == 'autohide'){
                let item = new Gtk.CheckButton({label: _('Autohide')});
                this.items.push(item);                
                this.vert_set_box.add(item);
				Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key == 'hide-effect') {
				let item = new Select(_('Autohide effect'));
				item.add([_('resize'), _('move')]);
				item.set_value(Schema.get_enum(key));
				this.items.push(item);
				this.vert_set_box.add(item.actor);
				item.selector.connect('changed', function(style){
					set_enum(style, Schema, key);
				});
			} else if (key == 'show-app-icon'){
                let item = new Gtk.CheckButton({label: _('Show application icon in the corner')})
                this.items.push(item);
                this.vert_set_box.add(item);
 				Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);		
            } else if (key == 'show-only-minimize-window'){
                let item = new Gtk.CheckButton({label: _('Display only minimized windows')})
                this.items.push(item);
                this.vert_set_box.add(item);
 				Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);		
            } else if (key == 'size') {
				let item = new IntSelect(_('Max item size of the dock'));
				item.set_args(1, 200, 1, 50);
				this.vert_set_box.add(item.actor);
				Schema.bind(key, item.spin, 'value', Gio.SettingsBindFlags.DEFAULT);
			} else if (key == 'position') {
				let item = new Select(_('Position of the dock'));
				item.add([_('left'), _('right')]);
				item.set_value(Schema.get_enum(key));
				this.vert_set_box.add(item.actor);
				item.selector.connect('changed', function(style){
					set_enum(style, Schema, key);
				});			
            } else if (key == 'show-window-tooltip'){
                let item = new Gtk.CheckButton({label: _('Show application title')})
                this.items.push(item);
                this.vert_set_box.add(item);
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);   
			} else if (key == 'show-close-button'){
                let item = new Gtk.CheckButton({label: _('Show application close button on hover')})
                this.items.push(item);
                this.vert_set_box.add(item);
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);         
            }
        }));
    this.main_vbox.show_all();
    }
});

function buildPrefsWidget(){
    let widget = new App();
    return widget.main_vbox;
};
