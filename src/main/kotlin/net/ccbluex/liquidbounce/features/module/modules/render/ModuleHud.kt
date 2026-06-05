/*
 * This file is part of LiquidBounce (https://github.com/CCBlueX/LiquidBounce)
 *
 * Copyright (c) 2015 - 2026 CCBlueX
 *
 * LiquidBounce is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * LiquidBounce is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with LiquidBounce. If not, see <https://www.gnu.org/licenses/>.
 */
package net.ccbluex.liquidbounce.features.module.modules.render

import net.ccbluex.liquidbounce.config.ConfigSystem
import net.ccbluex.liquidbounce.config.types.Value
import net.ccbluex.liquidbounce.config.types.group.Mode
import net.ccbluex.liquidbounce.config.types.group.ModeValueGroup
import net.ccbluex.liquidbounce.config.types.group.ToggleableValueGroup
import net.ccbluex.liquidbounce.event.EventManager
import net.ccbluex.liquidbounce.event.events.BrowserReadyEvent
import net.ccbluex.liquidbounce.event.events.DisconnectEvent
import net.ccbluex.liquidbounce.event.events.RefreshArrayListEvent
import net.ccbluex.liquidbounce.event.events.ScreenEvent
import net.ccbluex.liquidbounce.event.events.SpaceSeperatedNamesChangeEvent
import net.ccbluex.liquidbounce.event.handler
import net.ccbluex.liquidbounce.features.misc.HideAppearance.isDestructed
import net.ccbluex.liquidbounce.features.misc.HideAppearance.isHidingNow
import net.ccbluex.liquidbounce.features.module.ClientModule
import net.ccbluex.liquidbounce.features.module.ModuleCategories
import net.ccbluex.liquidbounce.integration.backend.browser.BrowserSettings
import net.ccbluex.liquidbounce.integration.screen.CustomScreenType
import net.ccbluex.liquidbounce.integration.screen.impl.CustomOverlay
import net.ccbluex.liquidbounce.render.engine.type.Color4b
import net.ccbluex.liquidbounce.utils.client.chat
import net.ccbluex.liquidbounce.utils.client.inGame
import net.ccbluex.liquidbounce.utils.client.markAsError
import net.minecraft.client.gui.screens.DisconnectedScreen
import net.minecraft.client.gui.screens.LevelLoadingScreen

/**
 * Module HUD
 *
 * The client in-game dashboard.
 */

object ModuleHud : ClientModule("HUD", ModuleCategories.RENDER, state = true, hide = true) {

    override val running
        get() = this.enabled && !isDestructed
    override val baseKey: String
        get() = "${ConfigSystem.KEY_PREFIX}.module.hud"

    private val isVisible: Boolean
        get() = !isHidingNow && inGame

    private var overlay = CustomOverlay(
        screenType = CustomScreenType.HUD,
        browserSettings = BrowserSettings(60, ::reopen)
    )

    init {
        treeAll(Blur, ArrayList, TargetHud)
    }

    object Blur : ToggleableValueGroup(ModuleHud, "Blur", enabled = true) {
        /**
         * The range in which the blending from not-blurred to blurred occurs.
         */
        val alphaBlendRange by floatRange("AlphaBlendRange", 0.0F..0.75F, 0.0F..1.0F)
    }

    object ArrayList : ToggleableValueGroup(ModuleHud, "ArrayList", enabled = true) {
        private fun refresh() = EventManager.callEvent(RefreshArrayListEvent)

        override fun onEnabledValueRegistration(value: Value<Boolean>) =
            value.onChanged { refresh() }

        val showTags by boolean("ShowTags", true).onChanged { refresh() }
        val rightSide by boolean("RightSide", true).onChanged { refresh() }
        val rightAligned by boolean("RightAligned", true).onChanged { refresh() }
        val descendingOrder by boolean("DescendingOrder", true).onChanged { refresh() }
        val horizontalOffset by int("HorizontalOffset", 10, 0..500, "px").onChanged { refresh() }
        val verticalOffset by int("VerticalOffset", 10, 0..500, "px").onChanged { refresh() }
        private val style = choices("Style", 0) {
            arrayOf(ClassicStyle(it), CompactStyle(it), OutlineStyle(it), MinimalStyle(it))
        }.onChanged { refresh() }

        private abstract class ArrayListStyle(name: String, final override val parent: ModeValueGroup<*>) : Mode(name) {
            protected fun refresh() = EventManager.callEvent(RefreshArrayListEvent)
        }

        private class ClassicStyle(parent: ModeValueGroup<*>) : ArrayListStyle("Classic", parent) {
            val fontSize by int("FontSize", 14, 8..28, "px").onChanged { refresh() }
            val horizontalPadding by int("HorizontalPadding", 8, 0..24, "px").onChanged { refresh() }
            val verticalPadding by int("VerticalPadding", 5, 0..16, "px").onChanged { refresh() }
            val backgroundColor by color("BackgroundColor", Color4b(7, 9, 13, 158)).onChanged { refresh() }
            val textColor by color("TextColor", Color4b.WHITE).onChanged { refresh() }
            val tagColor by color("TagColor", Color4b(154, 164, 178, 255)).onChanged { refresh() }
            val borderColor by color("BorderColor", Color4b(20, 184, 166, 255)).onChanged { refresh() }
        }

        private class CompactStyle(parent: ModeValueGroup<*>) : ArrayListStyle("Compact", parent) {
            val fontSize by int("FontSize", 12, 8..24, "px").onChanged { refresh() }
            val horizontalPadding by int("HorizontalPadding", 6, 0..20, "px").onChanged { refresh() }
            val verticalPadding by int("VerticalPadding", 3, 0..12, "px").onChanged { refresh() }
            val gap by int("Gap", 2, 0..10, "px").onChanged { refresh() }
            val backgroundColor by color("BackgroundColor", Color4b(7, 9, 13, 120)).onChanged { refresh() }
            val textColor by color("TextColor", Color4b.WHITE).onChanged { refresh() }
            val accentColor by color("AccentColor", Color4b(20, 184, 166, 255)).onChanged { refresh() }
        }

        private class OutlineStyle(parent: ModeValueGroup<*>) : ArrayListStyle("Outline", parent) {
            val fontSize by int("FontSize", 14, 8..28, "px").onChanged { refresh() }
            val horizontalPadding by int("HorizontalPadding", 8, 0..24, "px").onChanged { refresh() }
            val verticalPadding by int("VerticalPadding", 5, 0..16, "px").onChanged { refresh() }
            val outlineWidth by int("OutlineWidth", 1, 1..6, "px").onChanged { refresh() }
            val backgroundColor by color("BackgroundColor", Color4b(7, 9, 13, 80)).onChanged { refresh() }
            val textColor by color("TextColor", Color4b.WHITE).onChanged { refresh() }
            val tagColor by color("TagColor", Color4b(154, 164, 178, 255)).onChanged { refresh() }
            val outlineColor by color("OutlineColor", Color4b(20, 184, 166, 255)).onChanged { refresh() }
        }

        private class MinimalStyle(parent: ModeValueGroup<*>) : ArrayListStyle("Minimal", parent) {
            val fontSize by int("FontSize", 14, 8..28, "px").onChanged { refresh() }
            val horizontalPadding by int("HorizontalPadding", 2, 0..16, "px").onChanged { refresh() }
            val verticalPadding by int("VerticalPadding", 2, 0..12, "px").onChanged { refresh() }
            val textColor by color("TextColor", Color4b.WHITE).onChanged { refresh() }
            val tagColor by color("TagColor", Color4b(154, 164, 178, 255)).onChanged { refresh() }
            val shadow by boolean("Shadow", true).onChanged { refresh() }
        }
    }

    object TargetHud : ToggleableValueGroup(ModuleHud, "TargetHud", enabled = true) {
        private fun refresh() = EventManager.callEvent(RefreshArrayListEvent)

        override fun onEnabledValueRegistration(value: Value<Boolean>) =
            value.onChanged { refresh() }

        val horizontalOffset by int("HorizontalOffset", 20, -500..500, "px").onChanged { refresh() }
        val verticalOffset by int("VerticalOffset", 0, -500..500, "px").onChanged { refresh() }
        val hideDelay by int("HideDelay", 1000, 0..5000, "ms").onChanged { refresh() }
        val showArmor by boolean("ShowArmor", true).onChanged { refresh() }
        val showAbsorption by boolean("ShowAbsorption", true).onChanged { refresh() }
        val backgroundColor by color("BackgroundColor", Color4b(7, 9, 13, 190)).onChanged { refresh() }
        val textColor by color("TextColor", Color4b.WHITE).onChanged { refresh() }
        val dimmedTextColor by color("DimmedTextColor", Color4b(154, 164, 178, 255)).onChanged { refresh() }
        val healthProgressColor by color("HealthProgressColor", Color4b(20, 184, 166, 255)).onChanged {
            refresh()
        }
        val armorPointBackgroundColor by color("ArmorPointBackgroundColor", Color4b(64, 72, 84, 255)).onChanged {
            refresh()
        }
        val armorPointActiveColor by color("ArmorPointActiveColor", Color4b(45, 212, 191, 255)).onChanged {
            refresh()
        }
    }

    @Suppress("unused")
    private val spaceSeperatedNames by boolean("SpaceSeperatedNames", true).onChange { state ->
        EventManager.callEvent(SpaceSeperatedNamesChangeEvent(state))
        state
    }

    val isBlurEffectActive
        get() = Blur.enabled && !(mc.options.hideGui && mc.screen == null)

    override fun onEnabled() {
        if (isHidingNow) {
            chat(markAsError(message("hidingAppearance")))
        }

        if (isVisible) {
            overlay.open()
        }
    }

    override fun onDisabled() {
        overlay.close()
    }

    @Suppress("unused")
    private val browserReadyHandler = handler<BrowserReadyEvent> { event ->
        tree(overlay.browserSettings)
    }

    @Suppress("unused")
    private val screenHandler = handler<ScreenEvent> { event ->
        // Close the tab when the HUD is not running, is hiding now, or the player is not in-game
        if (!enabled || !isVisible) {
            overlay.close()
            return@handler
        }

        // Otherwise, open the tab and set its visibility
        overlay.visible = event.screen !is DisconnectedScreen && event.screen !is LevelLoadingScreen
    }

    @Suppress("unused")
    private val disconnectHandler = handler<DisconnectEvent> {
        overlay.close()
    }

    fun reopen() {
        overlay.close()
        if (enabled && isVisible) {
            overlay.open()
        }
    }

}
