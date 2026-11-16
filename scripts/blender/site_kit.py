"""The site kit: every 3D piece of the building site, made from code in Blender's model-kit style
(bevelled blocks, flat colours, no textures). Run headless:

    blender --background --factory-startup --python scripts/blender/site_kit.py -- out.glb

Each piece is one object at the origin, named as the game expects. Materials named "crate" are
recoloured by the game for each board column.
"""
import math
import sys

import bpy

OUT = sys.argv[sys.argv.index("--") + 1]

# Palette: warm model-kit tones; the game recolours "crate" per zone.
COLORS = {
    "wood": (0.78, 0.55, 0.32), "wood_dark": (0.55, 0.36, 0.20), "crate": (0.62, 0.64, 0.70),
    "wall": (0.96, 0.90, 0.80), "roof": (0.85, 0.30, 0.22), "window": (0.20, 0.32, 0.48),
    "steel": (0.98, 0.72, 0.10), "steel_dark": (0.20, 0.20, 0.24), "sign": (0.98, 0.98, 0.95),
    "post": (0.30, 0.30, 0.34), "fence": (0.98, 0.55, 0.12), "skin": (0.95, 0.76, 0.62),
    "jacket": (0.98, 0.55, 0.12), "trousers": (0.18, 0.26, 0.45), "helmet": (0.99, 0.80, 0.10),
}


def material(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    r, g, b = COLORS[name]
    m.diffuse_color = (r, g, b, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1)
    bsdf.inputs["Roughness"].default_value = 0.7
    return m


def block(size, location, mat, bevel=0.04, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    o.data.materials.append(material(mat))
    return o


def cylinder(radius, depth, location, mat, rotation=(0, 0, 0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=location, rotation=rotation, vertices=vertices)
    o = bpy.context.active_object
    o.data.materials.append(material(mat))
    return o


def sphere(radius, location, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=location, segments=20, ring_count=10)
    o = bpy.context.active_object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material(mat))
    return o


def join(parts, name):
    for p in parts:
        bpy.context.view_layer.objects.active = p
        for mod in list(p.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return o


def pallet():
    parts = [block((1.0, 1.0, 0.1), (0, 0, 0.05 + 0.1 * i), "wood" if i != 1 else "wood_dark") for i in range(2)]
    parts += [block((0.12, 1.0, 0.12), (x, 0, 0.16), "wood_dark", 0.02) for x in (-0.4, 0, 0.4)]
    parts.append(block((0.86, 0.86, 0.62), (0, 0, 0.55), "crate", 0.06))
    parts.append(block((0.9, 0.08, 0.66), (0, 0, 0.55), "wood", 0.02))
    return join(parts, "pallet")


def floor_module():
    parts = [block((3.0, 3.0, 1.0), (0, 0, 0.5), "wall", 0.05)]
    for i in (-1, 0, 1):
        for side, rot in ((1.5, 0), (-1.5, 0)):
            parts.append(block((0.5, 0.06, 0.5), (i * 0.9, side, 0.55), "window", 0.015))
            parts.append(block((0.06, 0.5, 0.5), (side, i * 0.9, 0.55), "window", 0.015))
    parts.append(block((3.1, 3.1, 0.08), (0, 0, 1.0), "roof", 0.02))
    return join(parts, "floor_module")


def zone_sign():
    parts = [cylinder(0.05, 1.6, (0, 0, 0.8), "post"), block((1.4, 0.08, 0.5), (0, 0, 1.55), "sign", 0.03)]
    parts.append(block((1.46, 0.06, 0.08), (0, 0, 1.28), "fence", 0.01))
    return join(parts, "zone_sign")


def crane():
    parts = [block((1.2, 1.2, 0.4), (0, 0, 0.2), "steel_dark", 0.04)]
    for z in range(9):
        parts.append(block((0.5, 0.5, 1.0), (0, 0, 0.9 + z), "steel", 0.03))
        parts.append(block((0.56, 0.56, 0.06), (0, 0, 0.4 + z), "steel_dark", 0.01))
    parts.append(block((0.8, 0.8, 0.7), (0, 0, 9.7), "steel_dark", 0.05))
    parts.append(block((9.0, 0.36, 0.36), (2.8, 0, 10.2), "steel", 0.03))
    parts.append(block((1.4, 0.9, 0.7), (-1.8, 0, 9.9), "steel_dark", 0.05))
    parts.append(cylinder(0.02, 3.0, (6.5, 0, 8.6), "post"))
    parts.append(block((0.3, 0.3, 0.3), (6.5, 0, 7.0), "steel_dark", 0.03))
    return join(parts, "crane")


def fence():
    parts = [block((2.0, 0.05, 1.0), (0, 0, 0.6), "fence", 0.02)]
    parts += [block((0.12, 0.3, 0.12), (x, 0, 0.06), "post", 0.02) for x in (-0.95, 0.95)]
    return join(parts, "fence")


def site_office():
    parts = [block((3.0, 2.0, 2.2), (0, 0, 1.1), "wall", 0.05), block((3.2, 2.2, 0.12), (0, 0, 2.26), "roof", 0.03)]
    parts.append(block((0.7, 0.06, 1.5), (-0.8, -1.0, 0.75), "window", 0.02))
    parts.append(block((1.0, 0.06, 0.7), (0.7, -1.0, 1.3), "window", 0.02))
    parts.append(block((1.2, 0.06, 0.32), (0.7, -1.01, 2.0), "sign", 0.02))
    return join(parts, "site_office")


def worker():
    parts = [
        block((0.22, 0.2, 0.7), (-0.13, 0, 0.35), "trousers", 0.05),
        block((0.22, 0.2, 0.7), (0.13, 0, 0.35), "trousers", 0.05),
        block((0.62, 0.36, 0.7), (0, 0, 1.05), "jacket", 0.08),
        block((0.16, 0.16, 0.6), (-0.4, 0, 1.05), "jacket", 0.05),
        block((0.16, 0.16, 0.6), (0.4, 0, 1.05), "jacket", 0.05),
        sphere(0.24, (0, 0, 1.6), "skin"),
        sphere(0.28, (0, 0, 1.72), "helmet", scale=(1, 1, 0.62)),
        cylinder(0.33, 0.04, (0, 0.02, 1.66), "helmet", vertices=24),
    ]
    return join(parts, "worker")


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.cursor.location = (0, 0, 0)
pieces = [pallet(), floor_module(), zone_sign(), crane(), fence(), site_office(), worker()]
for i, p in enumerate(pieces):
    p.location = (i * 12, 0, 0)  # spread out in the file; the game places each piece itself
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_apply=True)
print(f"site kit: {len(pieces)} pieces -> {OUT}")
