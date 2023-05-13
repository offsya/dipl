/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* Copyright (C) 2012 
 * Aleksandr Starun <aleksandr.starun@gmail.com>, 
 * Dmitriy Kostiuk <dmitriykostiuk@gmail.com>
 * Licence: GPLv2+
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this extension; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 * 
 * Some parts of this code were forked from Dock:
 *   https://extensions.gnome.org/extension/17/dock/
 *
 */

const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const Lang = imports.lang;
const Signals = imports.signals;
const St = imports.gi.St;
const Mainloop = imports.mainloop;

const AppFavorites = imports.ui.appFavorites;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Tweener = imports.ui.tweener;
const Workspace = imports.ui.workspace;
const AppDisplay = imports.ui.appDisplay;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

// Settings
const WTH_POSITION_KEY = 'position';
const WTH_SIZE_KEY = 'size';
const WTH_HIDE_KEY = 'autohide';
const WTH_EFFECTHIDE_KEY = 'hide-effect';
const WTH_AUTOHIDE_ANIMATION_TIME_KEY = 'hide-effect-duration';
const WTH_SHOW_APP_ICON = 'show-app-icon';
const WTH_SHOW_CLOSE_BUTTON = 'show-close-button';
const WTH_SHOW_WIN_TOOLTIP = 'show-window-tooltip';
const WTH_SHOW_ONLY_MINIMIZE_WINDOW = 'show-only-minimize-window';

// Old settings
let closeButtonSize = 24;
let thumbnail_size = 1;
let app_icon_size = 24;
let dockicon_size = 1;

// Keep enums in sync with GSettings schemas
const PositionMode = {
    LEFT: 0,
    RIGHT: 1
};

const AutoHideEffect = {
    RESIZE: 0,
    MOVE: 1,
    RESCALE: 2
};

const DND_RAISE_APP_TIMEOUT = 500;
const ITEM_LABEL_SHOW_TIME = 0.15;
const ITEM_LABEL_HIDE_TIME = 0.1;

// Utility function to make the dock clipped to the primary monitor
function updateClip(actor) {
    let monitor = Main.layoutManager.primaryMonitor;
    let allocation = actor.allocation;

    // Here we implicitly assume that the stage and actor's parent
    // share the same coordinate space
    let clip = new Clutter.ActorBox({ x1: Math.max(monitor.x, allocation.x1),
                      y1: Math.max(monitor.y, allocation.y1),
                      x2: Math.min(monitor.x + monitor.width, allocation.x2),
                      y2: Math.min(monitor.y + monitor.height, allocation.y2) });
    // Translate back into actor's coordinate space
    clip.x1 -= actor.x;
    clip.x2 -= actor.x;
    clip.y1 -= actor.y;
    clip.y2 -= actor.y;

    // Apply the clip
    actor.set_clip(clip.x1, clip.y1, clip.x2-clip.x1, clip.y2 - clip.y1);
}

/*************************************************************************************/
/**** start resize's Dock functions                                  *****************/
/*************************************************************************************/
function hideDock_size () {
    if (!this._hideable)
        return;

    let monitor = Main.layoutManager.primaryMonitor
    let position_x = monitor.x;
    let height = (this._nicons)*(this._item_size + this._spacing) + 2*this._spacing;
    let width = this._item_size + 4*this._spacing;

    Tweener.addTween(this, {
        _item_size: 1,
        time: this._settings.get_double(WTH_AUTOHIDE_ANIMATION_TIME_KEY),
        transition: 'easeOutQuad',
        onUpdate: function () {
            height = (this._nicons)*(this._item_size + this._spacing) + 2*this._spacing;
            width = this._item_size + 4*this._spacing;
            switch (this._settings.get_enum(WTH_POSITION_KEY)) {
            case PositionMode.LEFT:
                position_x=monitor.x-2*this._spacing;
                break;
            case PositionMode.RIGHT:
            default:
                position_x = monitor.x + (monitor.width-1-this._item_size-2*this._spacing);
            }
            this.actor.set_position (position_x,monitor.y+(monitor.height-height)/2);
            this.actor.set_size(width,height);

        updateClip(this.actor);
        },
    });

    this._hidden = true;
}

function showDock_size () {
    let monitor = Main.layoutManager.primaryMonitor;
    let height = (this._nicons)*(this._item_size + this._spacing) + 2*this._spacing;
    let width = this._item_size + 4*this._spacing;
    let position_x = monitor.x;

    Tweener.addTween(this, {
        _item_size: dockicon_size,
        time: this._settings.get_double(WTH_AUTOHIDE_ANIMATION_TIME_KEY),
        transition: 'easeOutQuad',
        onUpdate: function () {
            height = (this._nicons)*(this._item_size + this._spacing) + 2*this._spacing;
            width = this._item_size + 4*this._spacing;
            switch (this._settings.get_enum(WTH_POSITION_KEY)) {
            case PositionMode.LEFT:
                position_x=monitor.x-2*this._spacing;
                break;
            case PositionMode.RIGHT:
            default:
                position_x=monitor.x + (monitor.width-this._item_size-2*this._spacing);
            }
            this.actor.set_position (position_x, monitor.y+(monitor.height-height)/2);
            this.actor.set_size(width,height);

        updateClip(this.actor);
        }
    });

    this._hidden = false;
}

function showEffectAddItem_size () {
    let primary = Main.layoutManager.primaryMonitor;
    let height = (this._nicons)*(this._item_size + this._spacing) + 2*this._spacing;
    let width = this._item_size + 4*this._spacing;

    Tweener.addTween(this.actor, {
        y: primary.y + (primary.height-height)/2,
        height: height,
        width: width,
        time: this._settings.get_double(WTH_AUTOHIDE_ANIMATION_TIME_KEY),
        transition: 'easeOutQuad',
    onUpdate: function () {
        updateClip(this);
    }
    });
}

/**************************************************************************************/
/**** start rescale's Dock functions                                  *****************/
/**************************************************************************************/
function hideDock_scale () {
    if (!this._hideable)
        return;

    this._item_size = dockicon_size;
    let monitor = Main.layoutManager.primaryMonitor;
    let cornerX = 0;
    let height = this._nicons*(this._item_size + this._spacing) + 2*this._spacing;
    let width = this._item_size + 4*this._spacing;

    switch (this._settings.get_enum(WTH_POSITION_KEY)) {
    case PositionMode.LEFT:
        cornerX=monitor.x;
        break;
    case PositionMode.RIGHT:
    default:
        cornerX = monitor.x + monitor.width-1;
    }

    Tweener.addTween(this.actor,{
        y: monitor.y + (monitor.height-height)/2,
        x: cornerX,
        height:height,
        width: width,
        scale_x: 0.025,
        time: this._settings.get_double(WTH_AUTOHIDE_ANIMATION_TIME_KEY),
        transition: 'easeOutQuad',
    onUpdate: function() {
        updateClip(this);
    }
    });

    this._hidden = true;
}

function showDock_scale () {
    this._item_size = dockicon_size;
    let monitor = Main.layoutManager.primaryMonitor;
    let position_x = monitor.x;
    let height = this._nicons*(this._item_size + this._spacing) + 2*this._spacing;
    let width = this._item_size + 4*this._spacing;

    switch (this._settings.get_enum(WTH_POSITION_KEY)) {
    case PositionMode.LEFT:
        position_x=monitor.x-2*this._spacing;
        break;
    case PositionMode.RIGHT:
    default:
        position_x=monitor.x + (monitor.width-this._item_size-2*this._spacing);
    }
    Tweener.addTween(this.actor, {
        y: monitor.y + (monitor.height-height)/2,
        x: monitor.x + position_x,
        height: height,
        width: width,
        scale_x: 1,
        time: this._settings.get_double(WTH_AUTOHIDE_ANIMATION_TIME_KEY),
        transition: 'easeOutQuad',
    onUpdate: function() {
        updateClip(this);
    }
    });

    this._hidden = false;
}

function showEffectAddItem_scale () {
    let monitor = Main.layoutManager.primaryMonitor;
    let height = this._nicons*(this._item_size + this._spacing) + 2*this._spacing;
    let width = this._item_size + 4*this._spacing;

    Tweener.addTween(this.actor, {
        y: monitor.y + (monitor.height-height)/2,
        height: height,
        width: width,
        time: this._settings.get_double(WTH_AUTOHIDE_ANIMATION_TIME_KEY),
        transition: 'easeOutQuad',
    onUpdate: function() {
        updateClip(this);
    }
    });
}

/**************************************************************************************/
/**** start move Dock functions                                       *****************/
/**************************************************************************************/
function hideDock_move () {
    if (!this._hideable)
        return;

    this._item_size = dockicon_size;
    let monitor = Main.layoutManager.primaryMonitor;
    let cornerX = 0;
    let height = this._nicons*(this._item_size + this._spacing) + 2*this._spacing;
    let width = this._item_size + 4*this._spacing;

    switch (this._settings.get_enum(WTH_POSITION_KEY)) {
    case PositionMode.LEFT:
        cornerX= monitor.x - width + this._spacing;
        break;
    case PositionMode.RIGHT:
    default:
        cornerX = monitor.x + monitor.width - this._spacing;
    }

    Tweener.addTween(this.actor,{
        x: cornerX,
        y: monitor.y + (monitor.height - height)/2,
        width: width,
        height: height,
        time: this._settings.get_double(WTH_AUTOHIDE_ANIMATION_TIME_KEY),
        transition: 'easeOutQuad',
    onUpdate: function() {
        updateClip(this);
    },
    });

    this._hidden = true;
}

function showDock_move () {
    this._item_size = dockicon_size;
    let monitor = Main.layoutManager.primaryMonitor;
    let position_x = monitor.x;
    let height = this._nicons*(this._item_size + this._spacing) + 2*this._spacing;
    let width = this._item_size + 4*this._spacing;

    switch (this._settings.get_enum(WTH_POSITION_KEY)) {
    case PositionMode.LEFT:
        position_x=monitor.x - 2*this._spacing;
        break;
    case PositionMode.RIGHT:
    default:
        position_x=monitor.x + (monitor.width-this._item_size-2*this._spacing);
    }
    Tweener.addTween(this.actor, {
        x: position_x,
        y: monitor.y + (monitor.height - height)/2,
        width: width,
        height: height,
        time: this._settings.get_double(WTH_AUTOHIDE_ANIMATION_TIME_KEY),
        transition: 'easeOutQuad',
    onUpdate: function() {
        updateClip(this);
    },
    });

    this._hidden = false;
}

function showEffectAddItem_move () {
    let monitor = Main.layoutManager.primaryMonitor;
    let height = this._nicons*(this._item_size + this._spacing) + 2*this._spacing;
    let width = this._item_size + 4*this._spacing;

    Tweener.addTween(this.actor, {
        y: monitor.y + (monitor.height-height)/2,
        height: height,
        width: width,
        time: this._settings.get_double(WTH_AUTOHIDE_ANIMATION_TIME_KEY),
        transition: 'easeOutQuad',
    onUpdate: function() {
        updateClip(this);
    },
    });
}

const Dock = new Lang.Class({
    Name: 'Dock.Dock',

    _init : function() {

        // Load Settings
        this._settings = Convenience.getSettings();
        this._hidden = false;
        this._hideable = this._settings.get_boolean(WTH_HIDE_KEY);
        this._isShowAppIcon = this._settings.get_boolean(WTH_SHOW_APP_ICON);
        this._isShowCloseButton = this._settings.get_boolean(WTH_SHOW_CLOSE_BUTTON);        
        this._isShowWinTooltip = this._settings.get_boolean(WTH_SHOW_WIN_TOOLTIP);
        this._isShowOnlyMinWin = this._settings.get_boolean(WTH_SHOW_ONLY_MINIMIZE_WINDOW);
        
        let primary = Main.layoutManager.primaryMonitor;
        this._maxWidth = primary.width;
        this._maxHeight = primary.height * 8 / 10;

        this._spacing = 4;
        this._item_size = dockicon_size = this._settings.get_int(WTH_SIZE_KEY);
        this._nicons = 0;
        this._selectEffectFunctions(this._settings.get_enum(WTH_EFFECTHIDE_KEY));

        this.actor = new St.BoxLayout({ name: 'dock', vertical: true, reactive: true });

        this._grid = new Shell.GenericContainer();
        this.actor.add(this._grid, { expand: true, y_align: St.Align.START });
        this.actor.connect('style-changed', Lang.bind(this, this._onStyleChanged));

        this._grid.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this._grid.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this._grid.connect('allocate', Lang.bind(this, this._allocate));

        this._workId = Main.initializeDeferredWork(this.actor, Lang.bind(this, this._redisplay));

        this._appSystem = Shell.AppSystem.get_default();

        this._installedChangedId = this._appSystem.connect('installed-changed', Lang.bind(this, this._queueRedisplay));
        this._appFavoritesChangedId = AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._queueRedisplay));
        this._appStateChangedId = this._appSystem.connect('app-state-changed', Lang.bind(this, this._queueRedisplay));

        this._windowTrFocusAppId = Shell.WindowTracker.get_default().connect('notify::focus-app', Lang.bind(this, this._queueRedisplay));
        this._glWinManagerMapId = global.window_manager.connect('map', Lang.bind(this, this._queueRedisplay));
        this._glWinManagerDestroyId = global.window_manager.connect('destroy', Lang.bind(this, this._queueRedisplay));

        this._overviewShowingId = Main.overview.connect('showing', Lang.bind(this, function() {
            this.actor.hide();
        }));
        this._overviewHiddenId = Main.overview.connect('hidden', Lang.bind(this, function() {
            this.actor.show();
        }));
        Main.layoutManager.addChrome(this.actor,
                                     { affectsStruts: !this._settings.get_boolean(WTH_HIDE_KEY), trackFullscreen: true});

        //hidden
        this._settings.connect('changed::'+WTH_POSITION_KEY, Lang.bind(this, this._redisplay));
        this._settings.connect('changed::'+WTH_SIZE_KEY, Lang.bind(this, this._redisplay));
        this._settings.connect('changed::'+WTH_HIDE_KEY, Lang.bind(this, function (){
                Main.layoutManager.removeChrome(this.actor);
                Main.layoutManager.addChrome(this.actor,
                                             { affectsStruts: !this._settings.get_boolean(WTH_HIDE_KEY), trackFullscreen: true});

                this._hideable = this._settings.get_boolean(WTH_HIDE_KEY);
                if (this._hideable)
                    this._hideDock();
                else
                    this._showDock();
        }));

        this._settings.connect('changed::' + WTH_EFFECTHIDE_KEY, Lang.bind(this, function () {
            let hideEffect = this._settings.get_enum(WTH_EFFECTHIDE_KEY);

            // restore the effects of the other functions
            switch (hideEffect) {
            case AutoHideEffect.RESCALE:
                this._item_size = dockicon_size;
                break;
            case AutoHideEffect.RESIZE:
                this.actor.set_scale(1, 1);
                break;
            case AutoHideEffect.MOVE:
                this.actor.set_scale(1, 1);
                this._item_size = dockicon_size;
            }

            this.actor.disconnect(this._leave_event);
            this.actor.disconnect(this._enter_event);

            this._selectEffectFunctions(hideEffect);

            this._leave_event = this.actor.connect('leave-event', Lang.bind(this, this._hideDock));
            this._enter_event = this.actor.connect('enter-event', Lang.bind(this, this._showDock));
            this._redisplay();
        }));
        
        this._settings.connect('changed::'+WTH_SHOW_APP_ICON, Lang.bind(this, function () {
            this._isShowAppIcon = this._settings.get_boolean(WTH_SHOW_APP_ICON);
            this._redisplay();
        }));
        this._settings.connect('changed::'+WTH_SHOW_CLOSE_BUTTON, Lang.bind(this, function () {
            this._isShowCloseButton = this._settings.get_boolean(WTH_SHOW_CLOSE_BUTTON);
            this._redisplay();
        }));
        this._settings.connect('changed::'+WTH_SHOW_WIN_TOOLTIP, Lang.bind(this, function () {
            this._isShowWinTooltip = this._settings.get_boolean(WTH_SHOW_WIN_TOOLTIP);
            this._redisplay();
        }));
        this._settings.connect('changed::'+WTH_SHOW_ONLY_MINIMIZE_WINDOW, Lang.bind(this, function () {
            this._isShowOnlyMinWin = this._settings.get_boolean(WTH_SHOW_ONLY_MINIMIZE_WINDOW);
            this._redisplay();
        }));
        this._leave_event = this.actor.connect('leave-event', Lang.bind(this, this._hideDock));
        this._enter_event = this.actor.connect('enter-event', Lang.bind(this, this._showDock));

        this._redisplay();
        this._hideDock();
        this._redisplay();
    },

    destroy: function() {
        if (this._overviewHiddenId) {
            Main.overview.disconnect(this._overviewHiddenId);
            this._overviewHiddenId = 0;
        }

        if (this._overviewShowingId) {
            Main.overview.disconnect(this._overviewShowingId);
            this._overviewShowingId = 0;
        }

        if (this._glWinManagerDestroyId) {
            global.window_manager.disconnect(this._glWinManagerDestroyId);
            this._glWinManagerDestroyId = 0;
        }

        if (this._glWinManagerMapId) {
            global.window_manager.disconnect(this._glWinManagerMapId);
            this._glWinManagerMapId = 0;
        }

        if (this._windowTrFocusAppId) {
            Shell.WindowTracker.get_default().disconnect(this._windowTrFocusAppId);
            this._windowTrFocusAppId = 0;
        }

        if (this._appStateChangedId) {
            this._appSystem.disconnect(this._appStateChangedId);
            this._appStateChangedId = 0;
        }

        if (this._appFavoritesChangedId) {
            AppFavorites.getAppFavorites().disconnect(this._appFavoritesChangedId);
            this._appFavoritesChangedId = 0;
        }

        if (this._installedChangedId) {
            this._appSystem.disconnect(this._installedChangedId);
            this._installedChangedId = 0;
        }

        this.actor.destroy();

        // Break reference cycles
        this._settings.run_dispose();
        this._settings = null;
        this._appSystem = null;
    },

    // fuctions hide
    _restoreHideDock: function() {
        this._hideable = this._settings.get_boolean(WTH_HIDE_KEY);
    },

    _disableHideDock: function() {
        this._hideable = false;
    },

    _selectEffectFunctions: function(hideEffect) {
        switch (hideEffect) {
        case AutoHideEffect.RESCALE:
            this._hideDock = hideDock_scale;
            this._showDock = showDock_scale;
            this._showEffectAddItem = showEffectAddItem_scale;
            break;
        case AutoHideEffect.MOVE:
            this._hideDock = hideDock_move;
            this._showDock = showDock_move;
            this._showEffectAddItem = showEffectAddItem_move;
            break;
        case AutoHideEffect.RESIZE:
        default:
            this._hideDock = hideDock_size;
            this._showDock = showDock_size;
            this._showEffectAddItem = showEffectAddItem_size;
        }
    },

    _queueRedisplay: function () {
        Main.queueDeferredWork(this._workId);
    },

    _redisplay: function () {
        this._removeAll();

        let running = this._appSystem.get_running();

        let icons = 0;
        let nRows = 0;

        for (let i = 0; i < running.length; i++) {
            let app = running[i];
            let windows = app.get_windows();

            for (let j = 0; j< windows.length; j++) {
                if (!this._isShowOnlyMinWin) {
                    nRows++;
                } else if (windows[j].minimized) {
                    nRows++;
                }
            }
        }

        // What is 16?
        if (nRows) {
            thumbnail_size = this._maxHeight / nRows - this._spacing - 16;
            let max_thumbnail_size = 0.8 * this._settings.get_int(WTH_SIZE_KEY);

            if (thumbnail_size > max_thumbnail_size) {
                thumbnail_size =  max_thumbnail_size;
            }
            this._item_size = dockicon_size = thumbnail_size + 16;
        }

        for (let i = 0; i < running.length; i++) {
            let app = running[i];
            let windows = app.get_windows();
            for (let j = 0; j< windows.length; j++) {
                if (!this._isShowOnlyMinWin) {
                    let display = new DockThumbnail(this, app, windows[j], thumbnail_size, thumbnail_size);
                    icons++;
                    this._addItem(display.actor);
                } else if (windows[j].minimized) {
                    let display = new DockThumbnail(this, app, windows[j], thumbnail_size, thumbnail_size);
                    icons++;
                    this._addItem(display.actor);
                }
            }
        }
        this._nicons=icons;

        let height = (icons)*(this._item_size + this._spacing) + 2*this._spacing;
        let width = this._item_size + 4*this._spacing;

        if (running.length == 0) {
            // TEMPORARY! 
            this._item_size = dockicon_size = 1;
        }

        if (this._hideable && this._hidden) {
            this._hideDock();
        } else {
            if (dockicon_size == this._item_size) {
                this._showEffectAddItem ();
            } else {
                this._showDock ();
            }
        }
    },

    _getPreferredWidth: function (grid, forHeight, alloc) {
        alloc.min_size = this._item_size;
        alloc.natural_size = this._item_size + this._spacing;
    },

    _getPreferredHeight: function (grid, forWidth, alloc) {
        let children = this._grid.get_children();
        let nRows = children.length;
        let totalSpacing = Math.max(0, nRows - 1) * this._spacing;
        let height = nRows * this._item_size + totalSpacing;
        alloc.min_size = height;
        alloc.natural_size = height;
    },

    _allocate: function (grid, box, flags) {
        let children = this._grid.get_children();

        let x = box.x1 + this._spacing;
        if (this._settings.get_enum(WTH_POSITION_KEY) == PositionMode.LEFT)
            x = box.x1 + 2*this._spacing;
        let y = box.y1 + this._spacing;

        for (let i = 0; i < children.length; i++) {
            let childBox = new Clutter.ActorBox();
            childBox.x1 = x;
            childBox.y1 = y;
            childBox.x2 = childBox.x1 + this._item_size;
            childBox.y2 = childBox.y1 + this._item_size;
            children[i].allocate(childBox, flags);
            y += this._item_size + this._spacing;
        }
    },


    _onStyleChanged: function() {
        let themeNode = this.actor.get_theme_node();
        let [success, len] = themeNode.get_length('spacing', false);
        if (success)
            this._spacing = len;
        [success, len] = themeNode.get_length('-shell-grid-item-size', false);
        if (success)
            this._item_size = len;
        this._grid.queue_relayout();
    },

    _removeAll: function () {
        this._grid.get_children().forEach(Lang.bind(this, function (child) {
            child.destroy();
        }));
    },

    _addItem: function(actor) {
        this._grid.add_actor(actor);
    }
});
Signals.addSignalMethods(Dock.prototype);

DockThumbnail = new Lang.Class({
    Name: 'Dock.DockThumbnail',
    
    _init : function(dock, app, window, width, height) {
        this._dock = dock;
        this.app = app;
        this.window = window;
        this.highlighted = false;
        this.actor = new St.Button({style_class: 'dock-thumbnail',
                                    button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO,
                                    reactive: true,
                                    can_focus: true});

        this.actorBox = new Clutter.Group({clip_to_allocation: true});
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        this.actor.connect('enter-event', Lang.bind(this, this.select));
        this.actor.connect('leave-event', Lang.bind(this, this.unselect));
        this.actor.connect('clicked', Lang.bind(this, this._onClicked));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        this.actor.set_child(this.actorBox);

        this._menu = null;
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menuTimeoutId = 0;

        // Add window thumbnail with window close button.
        this._iconBin = new St.Bin({ x_fill: true, y_fill: true });
        this.iconWidth = width;
        this.iconHeight = height;
        this.set_size(this.iconWidth, this.iconHeight);  
        this.actorBox.add_actor(this._iconBin, { x_fill: true, y_fill: true } );

        if (this._dock._isShowCloseButton) {
            this._addCloseButton(this.actorBox, width);
        }

        // Add window title in tooltip.
        this._labelText = null;

        if (this._dock._isShowWinTooltip) {
            this._addApplicationTitle();
        }
    },

    select: function() {
        if (!this.highlighted) {
            this.actor.add_style_pseudo_class('hover');
            if (this._dock._isShowCloseButton) {
                this.closeButton.show();
            }
            this.highlighted = true;
            this.showLabel();
        }
    },

    unselect: function() {
        if (this.highlighted) {
            this.actor.remove_style_pseudo_class('hover');
            if (this._dock._isShowCloseButton) {
                this.closeButton.hide();
            }
            this.highlighted = false;
            this.hideLabel();
        }
    },

    set_size: function(iconWidth, iconHeight) {
        let clone = null;

        let mutterWindow = this.window.get_compositor_private();
        let windowTexture = mutterWindow.get_texture ();
        let [width, height] = windowTexture.get_size();
        let scale = Math.min(1.0, iconWidth / width, iconHeight / height);

        clone = new Clutter.Group({clip_to_allocation: true});
        clone.set_size(this.iconWidth, this.iconHeight);

        let windowClone = new Clutter.Clone (
            { source: windowTexture,
              reactive: true,
              x: (this.iconWidth - (width * scale)) / 2,
              y: (this.iconHeight - (height * scale)) / 2,
              width: width * scale,
              height: height * scale
            });

        clone.add_actor(windowClone);
        
        if (this._dock._isShowAppIcon) {
            this._addApplicationIcon(clone);
        }

        this._iconBin.set_size(iconWidth, iconHeight);
        this._iconBin.child = clone;
    },
    
    _removeMenuTimeout: function() {
        if (this._menuTimeoutId > 0) {
            Mainloop.source_remove(this._menuTimeoutId);
            this._menuTimeoutId = 0;
        }
    },    
    
    showLabel: function() {
        if (!this._labelText)
            return;

        if (this._is_label_show)
            return;

        this.label.set_text(this._labelText);
        this.label.opacity = 0;
        this.label.show();
        
        let [stageX, stageY] = this.actor.get_transformed_position();
        let itemHeight = this.actor.allocation.y2 - this.actor.allocation.y1;
        let labelHeight = this.label.get_height();
        let yOffset = Math.floor((itemHeight - labelHeight) / 2)

        let y = stageY + yOffset;
        let node = this.label.get_theme_node();
        let xOffset = node.get_length('-x-offset');

        let x;
        
        if (this._dock._settings.get_enum(WTH_POSITION_KEY) != PositionMode.LEFT)
            x = stageX - this.label.get_width() - xOffset;
        else
            x = stageX + this._dock.actor.get_width();

        this.label.set_position(x, y);

        Tweener.addTween(this.label,
                         { opacity: 255,
                           time: ITEM_LABEL_SHOW_TIME,
                           transition: 'easeOutQuad',
                         });
        this._is_label_show = true;
    },

    hideLabel: function () {
        if (!this._labelText)
            return;

        Tweener.addTween(this.label,
                         { opacity: 0,
                           time: ITEM_LABEL_HIDE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, function() {
                               this.label.hide();
                           })
                         });
        this._is_label_show = false;
    },
    
    _addApplicationIcon: function(parent) {

        if (this.app) {
            this._app_icon = this.app.create_icon_texture(app_icon_size);
        }
        if (!this._app_icon) {
            this._app_icon = new St.Icon({ icon_name: 'applications-other',
                                       icon_type: St.IconType.FULLCOLOR,
                                       icon_size: app_icon_size });
        }
        this._app_icon.width = app_icon_size;
        this._app_icon.height = app_icon_size;

        let applicationIconBox = null;

        if (this._dock._settings.get_enum(WTH_POSITION_KEY) == PositionMode.LEFT) {
            applicationIconBox = new St.Bin({x_align: St.Align.START, y_align: St.Align.END});
            applicationIconBox.set_size(app_icon_size, parent.height - app_icon_size / 2);
        }
        else {
            applicationIconBox = new St.Bin({x_align: St.Align.END, y_align: St.Align.END});
            applicationIconBox.set_size(parent.width, parent.height - app_icon_size / 2);
        }

        applicationIconBox.set_opacity(255);
        applicationIconBox.add_actor(this._app_icon);
        parent.add_actor(applicationIconBox);
    },

    _addApplicationTitle: function() {

        let title = this.window.get_title();

        if (!title) {
            title = this.app.get_name();
        }

        this._labelText = title;
        this.label = new St.Label({ style_class: 'dock-thumbnail-label'});
        this.label.hide();
        Main.layoutManager.addChrome(this.label);
        Main.overview.connect('hiding', Lang.bind(this, function() {
            this.hideLabel();
        }));
    },

    _addCloseButton: function(parent, parent_width) {
        let button = new St.Button({ style_class: 'window-close'});

        if (this._dock._settings.get_enum(WTH_POSITION_KEY) == PositionMode.LEFT) {
            this.closeBin = new St.Bin({x_align: St.Align.START, y_align: St.Align.END, x_fill: true, y_fill: true});
            this.closeBin.set_size(closeButtonSize, closeButtonSize * 6/5);
        }
        else {
            this.closeBin = new St.Bin({x_align: St.Align.END, y_align: St.Align.END});
            this.closeBin.set_size(parent_width + closeButtonSize * 1/8, closeButtonSize * 6/5);
        }    

        this.closeBin.child = button;
        parent.add_actor(this.closeBin);
        
        this.closeButton = button;
        this.closeButton.hide();
        this.closeButton.connect('clicked',
                                 Lang.bind(this, function() {
                                    this.closeWindow();
                                 }));
    },

    _onButtonPress: function(actor, event) {
        let button = event.get_button();
        if (button == 1) {
            this._removeMenuTimeout();
            this._menuTimeoutId = Mainloop.timeout_add(AppDisplay.MENU_POPUP_TIMEOUT, Lang.bind(this, function() {
                this.popupMenu();
            }));
        } else if (button == 3) {
            this.popupMenu();
        }
    },

    _onClicked: function(actor, button) {
        this._removeMenuTimeout();
        this.hideLabel();

        if (button == 1) {
            this._onActivate(Clutter.get_current_event());
        } else if (button == 2) {
            // Last workspace is always empty
            let launchWorkspace = global.screen.get_workspace_by_index(global.screen.n_workspaces - 1);
            launchWorkspace.activate(global.get_current_time());
            this.emit('launching');
            this.app.open_new_window(-1);
        }
        return false;
    },

    _onActivate: function (event) {
        this.emit('launching');
        let modifiers = event.get_state();

        if (modifiers & Clutter.ModifierType.CONTROL_MASK
            && this.app.state == Shell.AppState.RUNNING) {
            let current_workspace = global.screen.get_active_workspace().index();
            this.app.open_new_window(current_workspace);
        } else {
            let activeWindow = global.display.focus_window;

            if (this.window == activeWindow) {
                let current_workspace = global.screen.get_active_workspace();
                
                if (this.window.get_workspace() == current_workspace)
                    this.window.minimize();
            } else {
                Main.activateWindow(this.window);
            }
        }
        Main.overview.hide();
    },

    _onDestroy: function() {
        this.hideLabel();
        this._removeMenuTimeout();
    },
    
    popupMenu: function() {
        this.hideLabel();
        this._removeMenuTimeout();
        this.actor.fake_release();

        this._dock._disableHideDock();

        if (!this._menu) {
            this._menu = new DockThumbnailMenu(this);
            this._menu.connect('activate-window', Lang.bind(this, function (menu, window) {
                Main.activateWindow(this.window);
            }));
            this._menu.connect('open-state-changed', Lang.bind(this, function (menu, isPoppedUp) {
                if (!isPoppedUp){
                    //Restore value of autohidedock
                    this._dock._restoreHideDock();
                    this._dock._hideDock();

                    this._onMenuPoppedDown();
                }
            }));

            this._menuManager.addMenu(this._menu, true);
        }

        this._menu.redisplay();
        this._menu.open();

        return false;
    },

    closeWindow: function() {
        this.window.delete(global.get_current_time());
    }    
});
Signals.addSignalMethods(DockThumbnail.prototype);

const DockThumbnailMenu = new Lang.Class({
    Name: 'Dock.DockThumbnailMenu',
    Extends: PopupMenu.PopupMenu,

    _init: function(source) {
        let side;
        switch (source._dock._settings.get_enum(WTH_POSITION_KEY)) {
            case PositionMode.LEFT:
                side = St.Side.LEFT;
                break;
            case PositionMode.RIGHT:
            default:
                side = St.Side.RIGHT;
        }
        this.parent(source.actor, 0.5, side);

        this._source = source;

        this.connect('activate', Lang.bind(this, this._onActivate));

        this.actor.add_style_class_name('dock-menu');

        // Chain our visibility and lifecycle to that of the source
        source.actor.connect('notify::mapped', Lang.bind(this, function () {
            if (!source.actor.mapped)
                this.close();
        }));
        source.actor.connect('destroy', Lang.bind(this, function () { this.destroy(); }));

        Main.layoutManager.addChrome(this.actor);
    },

    redisplay: function() {
        this.removeAll();

        this._newWindowMenuItem = this._appendMenuItem(_("New Window"));
        this._closeWindowMenuItem = this._appendMenuItem(_("Close Window"));

        this._highlightedItem = null;
    },

    _appendSeparator: function () {
        let separator = new PopupMenu.PopupSeparatorMenuItem();
        this.addMenuItem(separator);
    },

    _appendMenuItem: function(labelText) {
        let item = new PopupMenu.PopupMenuItem(labelText);
        this.addMenuItem(item);
        return item;
    },

    popup: function(activatingButton) {
        this._redisplay();
        this.open();
    },

    _onActivate: function (actor, child) {
        if (child._window) {
            let metaWindow = child._window;
            this.emit('activate-window', metaWindow);
        } else if (child == this._newWindowMenuItem) {
            let current_workspace = global.screen.get_active_workspace().index();
            this._source.app.open_new_window(current_workspace);
            this.emit('activate-window', null);
        } else if (child == this._closeWindowMenuItem) {
            this._source.closeWindow();
        } 

        this.close();
    }
});

function init() {
    Convenience.initTranslations();
}

let dock;

function enable() {
    dock = new Dock();
}

function disable() {
    dock.destroy();
    dock = null;
}
