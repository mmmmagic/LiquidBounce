# LiquidBounce Project Structure And Performance Forecast

> Static analysis date: 2026-05-30. This is a source-code-based forecast, not a runtime benchmark. Actual cost depends on enabled modules, render distance, entity/block density, server packet rate, module settings such as range/radius, and whether browser/AI/script features are active.

## Rating

| Mark | Meaning |
| --- | --- |
| `-` | No obvious hot path or negligible cost in normal use |
| `L` | Low: small event handler, simple state change, occasional packet/config work |
| `M` | Medium: per-tick logic, moderate world/entity scans, packet interception, or regular UI/render work |
| `H` | High: frequent scans/rendering, packet queues, large state lists, or file/network-heavy feature |
| `VH` | Very high: likely bottleneck under high entity/block density, high packet rate, or wide radius/settings |

Heuristic used: CPU is driven by tick handlers, loops, world/entity/block scans and packet processing. GPU is driven by render handlers, meshes, lines/boxes/outlines, shaders and browser compositing. RAM is driven by packet queues, histories, caches, tracked entities/blocks, static meshes and config/model lists. Disk is driven by file/config/model/song/log reads or writes. Network is driven by packet manipulation plus HTTP/API/skin/account/marketplace calls.

## File Structure

```text
Liquidbounce/
├─ build.gradle.kts              Gradle root build, Fabric Loom, Kotlin, Node theme bundling
├─ settings.gradle.kts           Single Gradle root project: LiquidBounce
├─ buildSrc/                     Gradle build helper code
├─ config/                       Detekt and ktlint configuration
├─ gradle/                       Gradle wrapper files
├─ src/
│  ├─ main/java/                 Java mixins, interfaces, render and compatibility glue
│  ├─ main/kotlin/               Main Kotlin client implementation
│  └─ main/resources/            Fabric metadata, access widener, assets, shaders, models, particles, data
├─ src-theme/                    Svelte/Vite browser UI bundled into the mod
├─ src/test/                     Kotlin tests and fixtures
└─ zip_include/                  Extra packaging payload
```

### Kotlin Areas

| Area | Role | Static size |
| --- | --- | --- |
| `features` | Modules, commands, accounts, cosmetics, marketplace, misc feature managers | 773 files / 3310 KB |
| `utils` | Aiming, block search, inventory, movement, world, render, network utilities | 216 files / 1010 KB |
| `integration` | Browser backend, interop server, screens, tasks, theme bridge | 72 files / 299 KB |
| `render` | Custom render engine, fonts, meshes, GUI atlas, shaders/pipelines | 54 files / 260 KB |
| `config` | Config tree, Gson serialization, values, auto config | 50 files / 183 KB |
| `api` | HTTP client, auth/client/cosmetics/marketplace/user APIs | 45 files / 99 KB |
| `script` | GraalVM/Polyglot Script API and bindings | 23 files / 83 KB |
| `event` | Event manager and typed game/render/packet/input events | 18 files / 83 KB |
| `deeplearn` | DJL/PyTorch model bootstrap and model manager | 7 files / 21 KB |

### Java Areas

| Area | Role | Static size |
| --- | --- | --- |
| `injection` | Minecraft/Authlib/Blaze3D/Sodium/Lithium/DJL/Truffle/ViaVersion mixins | 159 files / 528 KB |
| `utils` | Java utility glue and compatibility helpers | 17 files / 44 KB |
| `render` | GUI/render Java helpers | 11 files / 25 KB |
| `interfaces` | Mixin bridge interfaces | 10 files / 12 KB |

### Resource And UI Assets

| Area | Notes |
| --- | --- |
| `src/main/resources/resources/liquidbounce/shaders` | Blur, circle, glow, GUI, outline and camera-relative shaders |
| `src/main/resources/resources/liquidbounce/particles` | Particle assets, about 550 KB |
| `src/main/resources/resources/liquidbounce/target_renderer` | Target render assets, about 306 KB |
| `src/main/resources/resources/liquidbounce/lang` | Language files, about 731 KB |
| `src-theme/src` | Svelte routes for click GUI, HUD, inventory, browser and menu |
| `src-theme/public/fonts` | Theme fonts, about 2.7 MB |
| `src-theme/public/img` | Theme/menu/HUD/clickgui images |

## Runtime Architecture

- `LiquidBounce.kt` initializes config, scripts, module manager, browser UI, API resources, cosmetics, marketplace, fonts and deep learning tasks.
- `ModuleManager.kt` registers 230 inbuilt `ClientModule` entries. Modules run through typed events such as tick, render, packet, input and world-change events.
- `BrowserBackendManager` starts CEF/external browser support and updates browser surfaces every `GameRenderEvent`; this is a persistent GPU/RAM cost when enabled.
- `src-theme` is a Svelte/Vite UI bundled into the client; runtime cost is mostly browser process memory, JS execution and compositing.
- `DeepLearningEngine` uses DJL with CPU PyTorch flavor and may download/cache engine libraries and models under the config root.
- `ScriptManager` starts a GraalVM Polyglot engine, scans user scripts and marketplace scripts, then enables them; script cost depends entirely on installed scripts.
- API services use HTTP for auth, updates, cosmetics, marketplace, skins, translation/OpenAI-related integrations and user data.

## Highest-Risk Hotspots

| Hotspot | Likely pressure |
| --- | --- |
| `StorageESP`, `BlockESP`, `BlockOutline`, `Breadcrumbs`, `ItemESP`, `Trajectories`, `Radar`, `Rotations`, `ProtectionZones` | GPU-heavy per-frame drawing; also CPU if scanning nearby blocks/entities |
| `StrongholdFinder`, `Scaffold`, `Fucker`, `LiquidFiller`, `AutoFarm`, `Surround`, `XRay`, `VoidESP`, `NewChunks` | CPU-heavy world/block/chunk scanning; can spike with radius/render distance |
| `Backtrack`, `FakeLag`, `Freeze`, `Blink`, `PingSpoof`, `PacketLogger`, `Notifier` | Packet interception/queueing; RAM and network timing sensitivity |
| `SkinChanger`, `AutoAccount`, `AntiStaff`, `MobOwners`, marketplace/API managers | Network/API and disk cache usage |
| `Notebot`, `DebugRecorder`, `PacketLogger`, `AutoConfig`, `Fucker` | Disk reads/writes or large local config/log/song data |
| Browser UI + Svelte theme | Baseline RAM/GPU cost even before individual render modules |
| Deep learning engine | Startup disk/network/cache cost; CPU inference by design because CUDA flavor is disabled |

## Inbuilt Module Forecast

The table below includes modules registered through `ModuleManager.registerInbuilt()`. The `Evidence` column is a compact count of source-code signals: `tick`, `render`, `packet`, `world`, `state`, `disk`, `net`.

| Category | Module | CPU | GPU | RAM | Disk | Net | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| COMBAT | Aimbot | M | H | L | - | - | tick:3, render:15, world:4 |
| COMBAT | AutoArmor | L | - | - | - | - | world:1 |
| COMBAT | AutoBow | - | - | - | - | - | world:1 |
| COMBAT | AutoClicker | M | L | M | - | M | tick:4, packet:9, world:9 |
| COMBAT | AutoDodge | H | M | M | - | M | tick:3, render:3, packet:11, world:14, net:1 |
| COMBAT | AutoLeave | L | - | - | - | - | tick:3 |
| COMBAT | AutoPearl | H | M | H | - | M | tick:7, render:10, packet:8, world:8, state:7 |
| COMBAT | AutoRod | H | M | L | - | - | tick:13, render:7, packet:1, world:7 |
| COMBAT | AutoShoot | H | M | L | - | - | tick:10, render:8, world:5 |
| COMBAT | AutoWeapon | L | L | L | - | - | render:1, world:4 |
| COMBAT | Backtrack | H | M | VH | - | VH | tick:3, render:6, packet:47, world:5, state:23 |
| COMBAT | Criticals | M | L | L | - | L | packet:5, world:7 |
| COMBAT | CrystalAura | L | L | L | - | - | tick:2, render:4, state:2 |
| COMBAT | ElytraTarget | M | M | - | - | - | tick:2, render:7, world:2 |
| COMBAT | FakeLag | H | M | H | L | VH | tick:2, render:5, packet:81, world:10, disk:1 |
| COMBAT | Hitbox | L | - | - | - | - | world:2 |
| COMBAT | KeepSprint | - | - | - | - | - | tick:1 |
| COMBAT | KillAura | H | VH | M | - | - | tick:8, render:25, world:10, state:2 |
| COMBAT | MaceKill | M | M | - | - | - | render:5, world:2 |
| COMBAT | NoMissCooldown | - | - | - | - | - |  |
| COMBAT | SuperKnockback | M | L | M | - | M | tick:2, render:1, packet:10, world:3 |
| COMBAT | SwordBlock | M | L | M | L | M | packet:12, world:4, disk:2 |
| COMBAT | TickBase | H | H | H | - | L | tick:12, render:14, packet:7, world:2, state:9 |
| COMBAT | TimerRange | M | - | L | - | M | tick:4, packet:7, world:3, net:2 |
| COMBAT | TpAura | M | M | - | - | - | tick:2, render:8, world:1 |
| COMBAT | Velocity | M | - | M | - | M | tick:2, packet:16 |
| EXPLOIT | AbortBreaking | - | - | - | - | - |  |
| EXPLOIT | AntiHunger | M | - | M | - | H | packet:21 |
| EXPLOIT | AntiReducedDebugInfo | - | - | - | - | - |  |
| EXPLOIT | BookBot | M | L | M | M | M | render:3, packet:8, world:3, state:6, disk:6, net:2 |
| EXPLOIT | ClickTp | H | H | L | - | L | tick:8, render:18, packet:2, world:9 |
| EXPLOIT | Damage | M | - | M | - | H | packet:24 |
| EXPLOIT | Disabler | - | - | - | L | - | disk:1 |
| EXPLOIT | Dupe | - | - | - | - | - | world:1 |
| EXPLOIT | GhostHand | - | - | - | - | - | world:1 |
| EXPLOIT | Kick | M | - | M | - | H | packet:22, world:3 |
| EXPLOIT | MoreCarry | L | - | L | - | L | packet:7 |
| EXPLOIT | MultiActions | - | - | - | - | - |  |
| EXPLOIT | NameCollector | M | L | L | M | L | packet:3, world:6, disk:5 |
| EXPLOIT | NoPitchLimit | L | - | L | - | L | packet:7 |
| EXPLOIT | Phase | - | - | - | - | - |  |
| EXPLOIT | PingSpoof | M | - | M | - | M | tick:2, packet:16, state:3 |
| EXPLOIT | Plugins | - | - | - | - | L | packet:2 |
| EXPLOIT | PortalMenu | - | - | - | - | - |  |
| EXPLOIT | ResetVL | L | - | - | - | L | tick:2, net:1 |
| EXPLOIT | ServerCrasher | - | - | - | - | - |  |
| EXPLOIT | SleepWalker | L | - | - | - | - | tick:2, world:1 |
| EXPLOIT | Teleport | M | L | M | - | H | render:1, packet:21, world:1 |
| EXPLOIT | TimeShift | M | - | M | - | M | tick:4, packet:13, world:2, net:1 |
| EXPLOIT | VehicleOneHit | M | - | L | - | M | packet:9, world:3 |
| EXPLOIT | YggdrasilSignatureFix | - | - | - | - | - |  |
| FUN | DankBobbing | - | - | - | - | - |  |
| FUN | Derp | M | - | - | - | - | tick:6 |
| FUN | HandDerp | M | - | M | - | M | tick:2, render:1, packet:19 |
| FUN | Notebot | H | H | M | H | M | tick:3, render:13, packet:11, world:2, disk:16 |
| FUN | SkinDerp | L | - | - | - | L | tick:2, world:1, net:3 |
| FUN | Twerk | L | - | - | - | - | tick:2 |
| FUN | Vomit | - | - | - | - | - | world:1 |
| MISC | AntiBot | L | - | L | - | M | packet:8, world:2 |
| MISC | AntiCheatDetect | - | - | - | - | - |  |
| MISC | AntiStaff | L | - | L | M | M | packet:7, disk:5, net:6 |
| MISC | AutoAccount | - | - | - | - | M | packet:2, net:5 |
| MISC | AutoChatGame | M | - | M | - | M | tick:4, packet:3, state:8, net:5 |
| MISC | AutoConfig | - | - | L | M | - | state:1, disk:9 |
| MISC | DebugRecorder | L | L | H | H | L | render:2, packet:3, state:12, disk:11 |
| MISC | EasyPearl | H | VH | L | - | - | tick:5, render:25, world:8 |
| MISC | FlagCheck | M | M | M | - | M | tick:5, render:10, packet:12, state:1 |
| MISC | GUICloser | - | - | - | L | - | packet:1, disk:2 |
| MISC | ItemScroller | L | - | - | - | - | world:3 |
| MISC | Macros | L | - | L | - | L | packet:2, world:1, state:2 |
| MISC | MiddleClickAction | L | - | - | - | - | tick:3, world:2 |
| MISC | NameProtect | H | M | H | - | L | tick:2, render:5, packet:3, world:1, state:10 |
| MISC | Notifier | H | L | VH | - | H | tick:3, packet:38, world:8, state:14 |
| MISC | PacketLogger | M | - | H | H | H | packet:31, state:6, disk:12 |
| MISC | Spammer | M | L | M | M | L | render:4, packet:2, state:3, disk:9, net:1 |
| MISC | TargetLock | L | - | M | - | - | tick:3, world:2, state:5 |
| MISC | Teams | L | L | L | - | - | render:1, world:3 |
| MISC | TextFieldProtect | - | - | - | - | - | render:1 |
| MOVEMENT | AirJump | L | L | - | - | - | tick:2, render:1, world:1 |
| MOVEMENT | Anchor | M | L | - | - | - | tick:8, render:4, world:1 |
| MOVEMENT | AntiBounce | - | - | - | - | - |  |
| MOVEMENT | AntiLevitation | - | - | - | - | - |  |
| MOVEMENT | AvoidHazards | H | H | M | - | - | tick:2, render:19, world:23 |
| MOVEMENT | BlockBounce | L | M | - | - | - | render:5, world:3 |
| MOVEMENT | BlockWalk | L | - | - | - | - | world:2 |
| MOVEMENT | Clip | M | M | L | - | - | tick:5, render:7, world:3 |
| MOVEMENT | ElytraFly | M | - | M | - | M | tick:5, packet:18, world:3 |
| MOVEMENT | ElytraRecast | L | - | L | - | M | packet:8, world:3 |
| MOVEMENT | EntityControl | - | - | - | - | - | world:1 |
| MOVEMENT | ExtendedFirework | - | L | - | - | - | render:1, world:1 |
| MOVEMENT | Fly | L | - | L | - | L | packet:7 |
| MOVEMENT | Freeze | H | M | H | - | VH | tick:2, render:12, packet:65, state:8 |
| MOVEMENT | HighJump | L | - | - | - | - | tick:3 |
| MOVEMENT | InventoryMove | M | L | M | - | M | tick:2, render:2, packet:19, world:2, state:1 |
| MOVEMENT | LiquidWalk | L | M | - | - | - | render:10, world:1 |
| MOVEMENT | LongJump | L | - | - | - | - | tick:3 |
| MOVEMENT | NoClip | M | - | L | - | L | tick:3, packet:7 |
| MOVEMENT | NoJumpDelay | - | - | - | - | - |  |
| MOVEMENT | NoPose | L | L | L | - | - | world:5 |
| MOVEMENT | NoPush | L | - | - | - | - | tick:3, world:1 |
| MOVEMENT | NoSlow | L | - | - | - | - | world:2 |
| MOVEMENT | NoWeb | M | - | - | - | - | tick:3, world:3 |
| MOVEMENT | Parkour | L | - | - | - | - | tick:2 |
| MOVEMENT | ReverseStep | H | L | M | - | M | tick:8, render:3, packet:8, world:2, state:6 |
| MOVEMENT | SafeWalk | L | L | - | - | - | tick:2, render:4, world:1 |
| MOVEMENT | Sneak | M | L | M | - | H | tick:3, render:2, packet:23 |
| MOVEMENT | Speed | - | - | - | - | - | world:1 |
| MOVEMENT | Spider | - | - | - | - | - |  |
| MOVEMENT | Sprint | L | - | - | - | - | tick:2, world:1 |
| MOVEMENT | Step | H | - | M | - | H | tick:8, render:1, packet:23, net:2 |
| MOVEMENT | Strafe | L | - | - | - | - | tick:2, world:1 |
| MOVEMENT | TargetStrafe | H | VH | L | - | - | tick:4, render:32, world:7 |
| MOVEMENT | TerrainSpeed | - | - | - | - | - |  |
| MOVEMENT | VehicleBoost | L | - | - | - | - | tick:2, world:1 |
| MOVEMENT | VehicleControl | M | - | - | - | - | tick:10, world:1 |
| PLAYER | AntiAFK | M | - | - | - | - | tick:10, world:1 |
| PLAYER | AntiExploit | - | - | - | - | - |  |
| PLAYER | AntiVoid | M | H | M | - | - | tick:4, render:13, world:4, state:4 |
| PLAYER | AutoBreak | L | - | - | - | - | world:2 |
| PLAYER | AutoBuff | M | - | - | - | - | tick:6 |
| PLAYER | AutoFish | M | L | L | - | M | tick:5, render:1, packet:10, world:2 |
| PLAYER | AutoQueue | - | - | H | - | - | state:13 |
| PLAYER | AutoRespawn | - | - | - | - | - |  |
| PLAYER | AutoShop | H | L | VH | L | - | tick:5, render:1, world:1, state:34, disk:3 |
| PLAYER | AutoWalk | L | - | - | - | - | tick:2 |
| PLAYER | AutoWindCharge | M | - | - | - | - | tick:6, world:1 |
| PLAYER | Blink | H | L | M | L | H | tick:5, packet:24, world:4, disk:1 |
| PLAYER | ChestCleaner | - | - | - | - | - |  |
| PLAYER | ChestStealer | M | - | M | - | - | world:1, state:3 |
| PLAYER | Eagle | M | L | - | - | - | tick:6, render:1, world:1 |
| PLAYER | ElytraSwap | L | - | - | - | - | world:2 |
| PLAYER | FastExp | M | L | L | - | - | tick:6, world:5 |
| PLAYER | FastUse | H | L | M | - | M | tick:8, packet:15, world:5, net:1 |
| PLAYER | InventoryCleaner | L | - | L | - | - | state:3 |
| PLAYER | NoBlockInteract | L | - | - | - | - | tick:4, world:1 |
| PLAYER | NoEntityInteract | M | L | L | - | - | world:5 |
| PLAYER | NoFall | L | - | L | - | L | packet:6, world:2 |
| PLAYER | NoRotateSet | - | - | - | - | - |  |
| PLAYER | NoSlotSet | L | - | L | - | M | packet:8 |
| PLAYER | Offhand | M | L | M | - | L | packet:5, world:6, state:2 |
| PLAYER | PotionSpoof | M | - | L | L | - | tick:3, world:2, state:1, disk:2 |
| PLAYER | Reach | - | - | - | - | - |  |
| PLAYER | Replenish | M | - | H | - | - | world:2, state:13 |
| PLAYER | ReportHelper | - | - | - | - | - |  |
| PLAYER | SmartEat | M | M | L | - | - | tick:7, render:7, world:5 |
| RENDER | Animations | L | L | - | - | - | render:2, world:1 |
| RENDER | AntiBlind | L | L | - | - | - | render:4, world:1 |
| RENDER | Aspect | - | - | - | - | - | render:1 |
| RENDER | AutoF5 | - | - | - | - | - | render:1 |
| RENDER | BedPlates | H | VH | M | - | - | tick:3, render:32, world:9, state:5 |
| RENDER | BetterChat | M | M | - | - | - | render:6 |
| RENDER | BetterInventory | M | VH | - | - | - | render:33, world:2 |
| RENDER | BetterTab | - | - | - | - | - | render:1 |
| RENDER | BlockESP | H | VH | M | - | - | tick:5, render:49, world:13, state:4 |
| RENDER | BlockOutline | H | VH | M | - | - | render:37, world:21 |
| RENDER | Breadcrumbs | M | VH | M | - | - | tick:2, render:39, world:5, state:7 |
| RENDER | CameraClip | - | L | - | - | - | render:2 |
| RENDER | Chams | M | H | - | L | - | render:20, disk:1 |
| RENDER | ClickGUI | L | - | L | - | - | tick:3, render:1, state:1 |
| RENDER | CombineMobs | M | M | H | L | - | render:8, world:9, state:11, disk:1 |
| RENDER | Crosshair | - | L | - | - | - | render:3 |
| RENDER | CrystalView | L | M | - | - | - | render:5 |
| RENDER | CustomAmbience | L | M | - | - | - | render:13 |
| RENDER | DamageParticles | M | M | M | - | - | tick:3, render:6, world:8, state:3 |
| RENDER | Debug | H | VH | H | - | - | tick:4, render:63, packet:1, world:8, state:10 |
| RENDER | ESP | M | M | - | L | - | render:12, world:2, disk:2 |
| RENDER | FreeCam | H | M | M | - | M | tick:10, render:4, packet:9, world:4 |
| RENDER | FreeLook | - | - | - | - | - | render:1 |
| RENDER | FullBright | M | L | - | - | - | tick:4, render:1, world:2 |
| RENDER | Hats | L | M | - | - | - | render:8 |
| RENDER | HitFX | M | L | L | - | L | render:1, packet:7, world:5 |
| RENDER | HoleESP | M | VH | L | - | - | render:28, world:4 |
| RENDER | HUD | L | L | - | L | - | render:2, disk:3 |
| RENDER | ItemChams | L | H | - | - | - | render:14 |
| RENDER | ItemESP | VH | VH | M | L | - | tick:5, render:45, world:33, state:2, disk:2 |
| RENDER | ItemTags | H | H | H | - | - | tick:2, render:20, world:12, state:12 |
| RENDER | JumpEffect | M | H | - | - | - | render:13, world:1 |
| RENDER | LogoffSpot | M | M | M | L | L | tick:3, render:3, packet:3, world:8, state:4, disk:1 |
| RENDER | MobOwners | M | L | L | - | M | render:1, packet:1, world:5, state:2, net:4 |
| RENDER | MurderMystery | H | H | M | - | M | render:19, packet:17, world:14 |
| RENDER | Nametags | M | H | L | - | - | render:14, world:1, state:2 |
| RENDER | NewChunks | VH | VH | H | - | H | render:20, packet:22, world:37, state:2 |
| RENDER | NoBob | - | - | - | - | - | render:1 |
| RENDER | NoFOV | - | - | - | - | - | render:1 |
| RENDER | NoHurtCam | - | - | - | - | - | render:1 |
| RENDER | NoSwing | - | - | - | - | - | render:1 |
| RENDER | Particles | M | H | L | - | - | tick:3, render:23, world:6, state:1 |
| RENDER | ProphuntESP | H | H | M | - | M | tick:3, render:12, packet:13, world:4 |
| RENDER | ProtectionZones | VH | VH | M | - | - | render:39, world:42, state:2 |
| RENDER | QuickPerspectiveSwap | - | - | - | - | - | render:1 |
| RENDER | Radar | M | VH | L | - | - | render:28, world:2, state:1 |
| RENDER | Rotations | M | VH | L | - | - | tick:2, render:33, world:4 |
| RENDER | SilentHotbar | - | L | - | - | - | render:3 |
| RENDER | SkinChanger | L | M | L | VH | VH | render:5, world:2, disk:33, net:54 |
| RENDER | SmoothCamera | - | L | - | - | - | render:1, world:1 |
| RENDER | StorageESP | VH | VH | H | L | - | tick:5, render:87, world:43, state:5, disk:2 |
| RENDER | TNTTimer | M | H | L | L | - | tick:2, render:13, packet:1, world:3, disk:2 |
| RENDER | Tracers | L | H | - | - | - | render:24 |
| RENDER | Trajectories | M | VH | L | - | - | render:35, world:8, state:1 |
| RENDER | TrueSight | L | M | L | - | - | render:5, world:4 |
| RENDER | VoidESP | VH | H | M | L | - | tick:3, render:10, world:23, disk:2 |
| RENDER | XRay | VH | H | M | M | - | render:9, world:100, disk:5 |
| RENDER | Zoom | - | - | - | - | - | render:1 |
| WORLD | AirPlace | M | H | L | - | - | render:15, world:13 |
| WORLD | AutoBuild | - | - | - | - | - | world:1 |
| WORLD | AutoDisable | L | - | L | - | L | packet:7 |
| WORLD | AutoFarm | VH | M | M | - | - | tick:12, render:4, world:28, state:1 |
| WORLD | AutoMobHeal | H | M | M | - | - | tick:4, render:3, world:25 |
| WORLD | AutoTool | L | L | L | - | L | world:6, net:1 |
| WORLD | AutoTrap | H | L | L | - | - | tick:10, world:7 |
| WORLD | BedDefender | M | L | L | - | - | tick:2, render:3, world:5, state:1 |
| WORLD | BlockIn | H | M | L | - | - | tick:4, render:1, world:12 |
| WORLD | BlockTrap | H | H | M | - | L | tick:2, render:17, packet:2, world:9, state:2 |
| WORLD | Extinguish | M | L | M | - | - | tick:5, world:11, state:1 |
| WORLD | FastBreak | M | - | L | - | M | tick:2, packet:14 |
| WORLD | FastPlace | L | - | - | - | - | world:3 |
| WORLD | Fucker | VH | H | H | VH | L | tick:12, render:16, packet:5, world:47, state:6, disk:24 |
| WORLD | HoleFiller | H | M | M | - | - | tick:2, render:7, world:15 |
| WORLD | InventoryTracker | M | M | VH | L | - | render:1, world:14, state:17, disk:2 |
| WORLD | LiquidFiller | VH | M | M | - | - | tick:2, world:30, state:1 |
| WORLD | LiquidPlace | - | - | - | - | - |  |
| WORLD | NoInterpolation | - | - | - | - | - |  |
| WORLD | NoSlowBreak | - | - | - | - | - |  |
| WORLD | Nuker | M | M | L | - | - | render:6, world:8 |
| WORLD | PacketMine | H | H | H | - | H | tick:4, render:10, packet:24, world:18 |
| WORLD | ProjectilePuncher | H | M | L | - | - | tick:7, render:8, world:7 |
| WORLD | Scaffold | VH | VH | M | - | L | tick:13, render:26, packet:5, world:53, net:1 |
| WORLD | StrongholdFinder | VH | VH | VH | - | H | tick:3, render:38, packet:31, world:70, state:29 |
| WORLD | Surround | VH | M | M | - | L | tick:6, render:6, packet:4, world:32 |
| WORLD | Timer | M | - | - | - | M | tick:10, world:1, net:8 |

## ClientModule Definitions Not Registered As Inbuilt

These source files define `ClientModule` objects but are not present in `ModuleManager.registerInbuilt()` at the time of analysis, so they are not included in the inbuilt-module table:

| Object | Module | Category | File |
| --- | --- | --- | --- |
| `ModuleDroneControl` | DroneControl | COMBAT | `combat/aimbot/ModuleDroneControl.kt` |
| `ModuleProjectileAimbot` | ProjectileAimbot | COMBAT | `combat/aimbot/ModuleProjectileAimbot.kt` |
| `ModuleBetterTitle` | BetterTitle | RENDER | `misc/ModuleBetterTitle.kt` |

## Practical Optimization Priorities

1. If FPS drops, first disable or tune radius/distance for `StorageESP`, `BlockESP`, `ItemESP`, `Trajectories`, `ProtectionZones`, `Radar`, `Rotations`, `Breadcrumbs`, `BedPlates`, `Debug`, `NewChunks`, `XRay` and `StrongholdFinder`.
2. If tick time or input latency spikes, inspect `Scaffold`, `Fucker`, `LiquidFiller`, `AutoFarm`, `Surround`, `StrongholdFinder`, `AutoDodge`, `KillAura`, `FakeLag`, `Backtrack`, `Freeze` and packet-heavy movement/exploit modules.
3. If memory grows, inspect packet queues and caches in `Backtrack`, `FakeLag`, `Freeze`, `Blink`, `Notifier`, `PacketLogger`, `AutoShop`, `InventoryTracker`, `StrongholdFinder`, plus browser UI and script modules.
4. If startup is slow or disk/network is busy, inspect browser dependency setup, DJL/PyTorch cache, marketplace refresh, cosmetics/skin/account API calls, `SkinChanger`, `PacketLogger`, `DebugRecorder`, `Notebot` and config/script loading.
