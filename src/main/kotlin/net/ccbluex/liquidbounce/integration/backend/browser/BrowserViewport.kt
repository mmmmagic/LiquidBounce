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

package net.ccbluex.liquidbounce.integration.backend.browser

import net.ccbluex.liquidbounce.utils.client.mc
import org.joml.Vector2d
import org.joml.Vector2dc
import org.joml.Vector2i
import org.joml.Vector2ic
import kotlin.math.ln

private const val FULLSCREEN_REFERENCE_GUI_SCALE = 3.0F
private const val FULLSCREEN_REFERENCE_CONTENT_SCALE = 0.65F

/**
 * Represents a browser viewport in Minecraft GUI-scaled coordinates.
 */
@JvmRecord
data class BrowserViewport(
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int,
    val fullScreen: Boolean = false
) {

    /**
     * Transform global coordinates to viewport-relative coordinates
     * @return Pair of (transformedX, transformedY) coordinates
     */
    fun transform(globalX: Double, globalY: Double): Vector2dc =
        Vector2d(globalX - x, globalY - y)

    /**
     * Get the scaled dimensions for rendering based on quality setting
     * @return Pair of (scaledWidth, scaledHeight)
     */
    fun getScaledDimensions(quality: Float): Vector2ic {
        val scale = getRenderScale(quality)
        return Vector2i(
            (width * scale).toInt().coerceAtLeast(1),
            (height * scale).toInt().coerceAtLeast(1)
        )
    }

    /**
     * Calculate zoom level based on the render scale.
     */
    fun getZoomLevel(quality: Float): Double {
        val scale = getRenderScale(quality) * getContentScale()
        return ln(scale.toDouble()) / ln(1.2)
    }

    /**
     * Transform mouse coordinates according to the browser render scale
     * @return Pair of (scaledX, scaledY) coordinates
     */
    fun transformMouse(mouseX: Double, mouseY: Double, quality: Float): Vector2ic {
        val scale = getRenderScale(quality)
        return Vector2i((mouseX * scale).toInt(), (mouseY * scale).toInt())
    }

    private fun getRenderScale(quality: Float): Float =
        quality * mc.window.guiScale.toFloat()

    private fun getContentScale(): Float {
        if (!fullScreen) {
            return 1.0F
        }

        val guiScale = mc.window.guiScale.toFloat().coerceAtLeast(1.0F)
        return FULLSCREEN_REFERENCE_CONTENT_SCALE * FULLSCREEN_REFERENCE_GUI_SCALE / guiScale
    }

    companion object {
        /**
         * Creates a fullscreen viewport matching the current Minecraft GUI dimensions.
         */
        val FULLSCREEN
            get() = BrowserViewport(
                x = 0,
                y = 0,
                width = mc.window.guiScaledWidth,
                height = mc.window.guiScaledHeight,
                fullScreen = true
            )
    }
}
