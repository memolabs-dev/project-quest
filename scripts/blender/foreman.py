"""The site manager: KayKit's Knight (CC0, Kay Lousberg) turned into a foreman. Weapons, shields, cape and
helmet go; an orange jacket, blue trousers and a yellow hard hat come in; only the animations the game plays
are kept. Run headless:

    blender --background --factory-startup --python scripts/blender/foreman.py -- assets-src/kaykit/Knight.glb out.glb
"""
import sys

import bpy

SRC, OUT = sys.argv[sys.argv.index("--") + 1 :][:2]
KEEP_CLIPS = {
    "Idle", "Unarmed_Idle", "Walking_A", "Running_A", "Jump_Full_Short", "Interact", "PickUp", "Cheer",
    "Lie_Idle", "Sit_Floor_Idle", "Use_Item", "Hit_A",
}
DROP = {"1H_Sword", "1H_Sword_Offhand", "2H_Sword", "Badge_Shield", "Rectangle_Shield", "Round_Shield",
        "Spike_Shield", "Knight_Cape", "Knight_Helmet", "Icosphere"}
COLORS = {"jacket": (0.98, 0.45, 0.08), "trousers": (0.16, 0.24, 0.45), "helmet": (0.99, 0.78, 0.08)}


def flat(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*COLORS[name], 1)
    bsdf.inputs["Roughness"].default_value = 0.7
    return m


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

for name in DROP:
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)
for action in list(bpy.data.actions):
    if action.name not in KEEP_CLIPS:
        bpy.data.actions.remove(action)

# Workwear: the body and arms become the jacket, the legs the trousers; the face keeps KayKit's texture.
for name, mat in (("Knight_Body", "jacket"), ("Knight_ArmLeft", "jacket"), ("Knight_ArmRight", "jacket"),
                  ("Knight_LegLeft", "trousers"), ("Knight_LegRight", "trousers")):
    o = bpy.data.objects[name]
    o.data.materials.clear()
    o.data.materials.append(flat(mat))

# The hard hat, parented to the head bone so it follows every animation.
rig = bpy.data.objects["Rig"]
head = rig.data.bones["head"]
head_top = rig.matrix_world @ head.head_local
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.62, segments=24, ring_count=12, location=(head_top.x, head_top.y, head_top.z + 1.05))
hat = bpy.context.active_object
hat.scale = (1, 1, 0.68)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="DESELECT")
bpy.ops.object.mode_set(mode="OBJECT")
for v in hat.data.vertices:  # keep the dome only
    v.select = v.co.z < -0.02
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.delete(type="VERT")
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.mesh.primitive_cylinder_add(radius=0.74, depth=0.06, vertices=32, location=(head_top.x, head_top.y + 0.06, head_top.z + 1.05))
brim = bpy.context.active_object
bpy.ops.object.select_all(action="DESELECT")
hat.select_set(True)
brim.select_set(True)
bpy.context.view_layer.objects.active = hat
bpy.ops.object.join()
bpy.ops.object.shade_smooth()
hat.name = "hard_hat"
hat.data.materials.clear()
hat.data.materials.append(flat("helmet"))
world = hat.matrix_world.copy()
hat.parent = rig
hat.parent_type = "BONE"
hat.parent_bone = "head"
hat.matrix_world = world

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS")
print(f"foreman: {len(bpy.data.actions)} clips -> {OUT}")
