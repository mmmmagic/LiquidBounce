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
package net.ccbluex.liquidbounce.integration.ui

import net.ccbluex.liquidbounce.LiquidBounce
import net.ccbluex.liquidbounce.config.ConfigSystem
import net.ccbluex.liquidbounce.integration.backend.BrowserBackendManager
import net.ccbluex.liquidbounce.integration.backend.browser.Browser
import net.ccbluex.liquidbounce.integration.backend.browser.BrowserSettings
import net.ccbluex.liquidbounce.integration.backend.input.InputAcceptor
import net.ccbluex.liquidbounce.integration.interop.ClientInteropServer
import net.ccbluex.liquidbounce.integration.interop.middleware.AuthMiddleware
import net.ccbluex.liquidbounce.integration.screen.CustomScreenType
import net.ccbluex.liquidbounce.utils.client.mc
import net.minecraft.client.gui.screens.ChatScreen
import java.io.File

object FixedClientUi {

    private val files = listOf("index.html", "style.css", "app.js")
    private val takesInputHandler = InputAcceptor { mc.screen != null && mc.screen !is ChatScreen }

    val resourceFolder: File
        get() {
            val targetFolder = File(ConfigSystem.rootFolder, "cache/fixed-ui")

            if (targetFolder.exists() && !targetFolder.deleteRecursively()) {
                error("Unable to clear fixed UI cache at ${targetFolder.absolutePath}")
            }

            if (!targetFolder.mkdirs() && !targetFolder.isDirectory) {
                error("Unable to create fixed UI cache at ${targetFolder.absolutePath}")
            }

            for (file in files) {
                LiquidBounce.resource("ui/lightweight/$file").use { input ->
                    File(targetFolder, file).outputStream().use(input::copyTo)
                }
            }

            return targetFolder
        }

    fun url(customScreenType: CustomScreenType? = null, markAsStatic: Boolean = false): String {
        val screenName = customScreenType?.routeName.orEmpty()
        val baseUrl = "${ClientInteropServer.url}/ui/?${AuthMiddleware.AUTH_CODE_PARAM}=" +
            "${ClientInteropServer.AUTH_CODE}#/$screenName"

        return if (markAsStatic) "$baseUrl?static" else baseUrl
    }

    fun isScreenSupported(customScreenType: CustomScreenType) = customScreenType == CustomScreenType.CLICK_GUI

    fun isOverlaySupported(customScreenType: CustomScreenType) = customScreenType == CustomScreenType.HUD

    fun isSupported(customScreenType: CustomScreenType) =
        isScreenSupported(customScreenType) || isOverlaySupported(customScreenType)

    fun openImmediate(
        customScreenType: CustomScreenType? = null,
        markAsStatic: Boolean = false,
        settings: BrowserSettings
    ): Browser {
        val backend = BrowserBackendManager.backend ?: error("Browser backend is not initialized.")

        return backend.createBrowser(
            url(customScreenType, markAsStatic),
            settings = settings
        )
    }

    fun openInputAwareImmediate(
        customScreenType: CustomScreenType? = null,
        markAsStatic: Boolean = false,
        settings: BrowserSettings,
        priority: Short = 10,
        inputAcceptor: InputAcceptor = takesInputHandler
    ): Browser {
        val backend = BrowserBackendManager.backend ?: error("Browser backend is not initialized.")

        return backend.createBrowser(
            url(customScreenType, markAsStatic),
            settings = settings,
            priority = priority,
            inputAcceptor = inputAcceptor
        )
    }

    fun updateImmediate(
        browser: Browser?,
        customScreenType: CustomScreenType? = null,
        markAsStatic: Boolean = false
    ) {
        browser?.url = url(customScreenType, markAsStatic)
    }

}
