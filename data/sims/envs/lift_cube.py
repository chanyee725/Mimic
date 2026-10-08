"""Lift a cube: a red cube 28 cm in front of the robot at the edge of a table, a tray to its right.

Copy into the environments folder (data/sims/envs/), Rescan, and tag it with a robot on the
Environments page (e.g. so101_follower, whose USD sits in data/sims/robots/).
"""

TABLE_TOP = 0.75  # sim/assets/table surface height (m)


def build(scene):
    scene.add("table")
    scene.add("cube", pos=(0, 0.08, TABLE_TOP))
    scene.add("tray", pos=(0.2, 0.0, TABLE_TOP))
    # SO-101 faces -Y in its own frame; yaw 180 turns it toward the cube
    scene.robot(pos=(0, -0.2, TABLE_TOP), yaw=180)
