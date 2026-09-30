# クライマーの立体。CHARACTERS の5人（菅野あいと・明神・森秋彩・オンドラ・平山ユージ）を
# 同じ型から作り分ける。身長・細さ・髪・服と靴の配色・チョークの持ち方が人ごとに変わる。
# 作りは3つあって、見比べられるようにしてある。
#
#   blocky   いまのローポリ。面が大きく、色は部位ごとに1色。手は筒1本
#   blocky_fingers   blocky と同じ作りで、手だけ指まで作る
#   facet    MBTIの絵に寄せた三角ポリゴン。面を割って、同じ色相のまま面ごとに濃さを振る
#   organic  subdivision をかけた滑らかな作り
#
# 頭を大きくした版が2つある。どちらも丸顔（HEAD_SHAPES の "round"）:
#   bighead          facet の頭を 1.55 倍にしたもの
#   bighead_organic  organic の頭を 1.55 倍にしたもの
#
# 道具は本人の写真（Google フォト「クライミング」2026-06-07）に合わせている:
#   シューズ    赤の甲 / 黒のラバー（トゥ・ソール・ヒール）/ 黒のベルクロ1本 / 踵の引きタブ
#   チョーク    クリーム色のチョークバケツ（黒の口回りと底テープ・赤い書き文字）に
#               黒キャンバスのチョークバッグ（白ロゴ）が挿してある。
#               バッグの上は窄まらず、布が横一文字に折れて閉じる
#   服装        黒のゆったりしたTシャツ / ピンクの短パン（膝から下は素足）
#
# Blender 側で:
#   CLIMBERS_STYLES = ["blocky", "facet", "organic"]        # 省略時は blocky だけ
#   exec(open('/Users/myo/git/climbing-research/scripts/blender/climbers.py').read())
#
# ---- Blender で手を入れるときの決まり ----
#
# 直すのは格子の直立（grid_<人>_<作り>_stand）。
#   ・CLIMBERS_STYLES で作る tmp_<人>_<作り>_stand の単体は、格子の直立と同じものなので置かない。
#     見比べる絵が要るときも、格子の直立を撮って、作ったら消す
#   ・build_grid() の最後で link_same_meshes() が走り、中身が同じメッシュは
#     1つのデータになる。チョークや靴を直立で1つ直せば、同じ作りの行が全部変わる
#   ・形そのものを変えるならこのファイルの数値を直して組み直す。それが本来のマスター
#
# 手で直すときは編集モード（Tab）で頂点を動かす。
#   ・共有されるのはメッシュデータだけ。オブジェクトの位置・回転・拡大縮小は
#     1体ずつが別々に持つので、オブジェクトモードの G / R / S は他に出ない
#   ・オブジェクトモードでかけたスケールは Ctrl+A では焼けない。
#     複数人で使っているデータには適用できないと断られる
#   ・何かの拍子にデータが切り離されたら、link_poses() と link_same_meshes() を
#     もう一度走らせれば共有に戻る

import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix, Quaternion

# ---------------------------------------------------------------- 名前
# コレクション名は必ず 4枠。<役割>_<人>_<作り>_<ポーズ>
# 枠を省くと、名前を見ただけでは何なのか分からないものが混ざる。
# 当てはまらない枠は NA で埋める（チョークのマスターにポーズはない、など）。
COLL_ROLES = ("grid", "wall", "gear", "ground", "tmp")
NA = "any"


def make_coll_name(role, character, style=NA, pose=NA):
    """コレクション名を組む。人・作り・ポーズは必ず入れる。

    役割は grid（格子）/ wall（壁の列）/ gear（道具のマスター）/
    ground（地面）/ tmp（使い捨て。いつ消してもよい）のどれか。
    ポーズ id にアンダースコアを使わないこと。作り id は使ってよい
    （bighead_organic など）。名前は末尾から解くので、ポーズが1語なら
    どこまでが作りか決まる。"""
    if role not in COLL_ROLES:
        raise ValueError(f"役割は {COLL_ROLES} のどれか: {role}")
    return f"{role}_{character}_{style or NA}_{pose or NA}"


# 中身を持たない入れ物。枠なしの名前を許す唯一の例外
COLL_CONTAINERS = ("tmp",)


def parse_coll(name):
    """コレクション名を4枠に割る。規則から外れていれば None。
    どれが放置されたものかは、これが None を返すかどうかで分かる。"""
    t = name.split(".")[0].split("_")
    if t == list(COLL_CONTAINERS[:1]) or name.split(".")[0] in COLL_CONTAINERS:
        return {"role": t[0], "character": None, "style": None, "pose": None}
    if len(t) < 4 or t[0] not in COLL_ROLES:
        return None
    return {"role": t[0], "character": t[1], "style": "_".join(t[2:-1]), "pose": t[-1]}



# ---------------------------------------------------------------- パレット
PALETTE = dict(
    bg     = (0.969, 0.957, 0.945),   # #F7F5F1 地色
    skin   = (0.839, 0.635, 0.490),
    hair   = (0.102, 0.102, 0.102),   # #1A1A1A
    tee    = (0.118, 0.125, 0.141),   # #1E2024 黒いシャツ
    pants  = (0.871, 0.549, 0.584),   # #DE8C95 ピンクの短パン
    red    = (0.690, 0.271, 0.243),   # #B0453E シューズの甲
    rubber = (0.180, 0.200, 0.231),   # #2E333B ベルクロ・引きタブ・履き口のふち
    rand   = (0.180, 0.200, 0.231),   # つま先と踵を包むラバー。甲と同じ「ベース」の側
    sole   = (0.180, 0.200, 0.231),   # ソール
    # rubber / rand / sole は aito では同じ色。人によって塗り分けられるよう分けてある
    cream  = (0.929, 0.914, 0.882),   # #EDE9E1 チョークバケツ
    ink    = (0.227, 0.247, 0.275),   # #3A3F46 バケツの口回り・底テープ
    scrawl = (0.620, 0.227, 0.247),   # #9E3A3F バケツの赤い書き文字
    canvas = (0.169, 0.184, 0.208),   # #2B2F35 チョークバッグ（置きバケツに挿すほう）
    bag_band = (0.929, 0.914, 0.882),   # #EDE9E1 腰のバッグの上部バンド（クリーム）
    bag_body = (0.855, 0.871, 0.745),   # #DADEBE 腰のバッグの袋（緑がかったクリーム）
    logo   = (0.949, 0.941, 0.922),
    wall   = (0.855, 0.835, 0.800),   # #DAD5CC 壁パネル
    hold   = (0.620, 0.227, 0.247),   # ホールド
)

ALPHA = {"wall": 0.32}      # 半透明にするもの

# ---------------------------------------------------------------- 人物
# 体つきと服の色だけを人ごとに持つ。形を作る仕掛けは全員で共通で、
# 組み上げたあとに身長と太さぶんだけ縮める。
#   height  身長（m）
#   slim    横幅の倍率。小さいほど細い
#   pants   short（短パン）/ long（長ズボン）
#   palette PALETTE のうち、その人だけ違う色
CHARACTERS = {
    "aito": dict(height=1.72, slim=1.00, pants="short", palette={}),
    "manabu": dict(
        height=1.70,
        slim=0.94,
        pants="long",
        hair="curly",           # 天然パーマ
        curl_size=0.70,         # カールの粒。小さいほど細かい
        sole_top=0.026,         # 黒いソールを厚く見せる
        chalk="waist",          # チョークバッグは腰に着ける（置きバケツを持たない）
        palette=dict(
            skin   = (0.718, 0.533, 0.404),   # #B78867 aito より少し暗い肌
            tee    = (0.776, 0.871, 0.561),   # #C6DE8F うすい黄緑のTシャツ
            pants  = (0.180, 0.290, 0.200),   # #2E4A33 濃い緑の長ズボン
            red    = (0.431, 0.776, 0.878),   # #6EC6E0 靴のベース（水色）。甲と履き口
            rand   = (0.431, 0.776, 0.878),   # つま先と踵のラバーもベースと同じ水色
            rubber = (0.910, 0.761, 0.141),   # #E8C224 靴のポイント（黄）。ベルクロ・引きタブ
            sole   = (0.098, 0.102, 0.110),   # #19191C 靴のソール（黒）
        ),
    ),
    # 以下3人は実在のクライマー。身長は公表値、髪と服の色は
    # Wikimedia Commons の写真を見て決めている（2026-09-29 に確認）
    "ondra": dict(          # アダム・オンドラ 186cm。長身で細い、巻き毛
        height=1.86,
        slim=0.90,
        pants="short",
        hair="curly",
        palette=dict(
            skin   = (0.902, 0.769, 0.659),
            hair   = (0.227, 0.165, 0.118),   # 濃い茶
            tee    = (0.169, 0.549, 0.769),   # 青
            pants  = (0.165, 0.180, 0.200),
            red    = (0.949, 0.776, 0.196),   # 黄の甲
            rand   = (0.129, 0.129, 0.137),
            rubber = (0.129, 0.129, 0.137),
            sole   = (0.098, 0.102, 0.110),
        ),
    ),
    "mori": dict(           # 森秋彩 154cm。小柄、黒のボブ
        height=1.54,
        slim=0.86,
        pants="short",
        hair="bob",
        palette=dict(
            skin   = (0.863, 0.702, 0.580),
            tee    = (0.141, 0.173, 0.259),   # 紺
            pants  = (0.106, 0.125, 0.188),
            red    = (0.784, 0.239, 0.259),
            rand   = (0.129, 0.129, 0.137),
            rubber = (0.129, 0.129, 0.137),
            sole   = (0.098, 0.102, 0.110),
        ),
    ),
    "hirayama": dict(       # 平山ユージ 173cm。短い黒髪、日に焼けた肌
        height=1.73,
        slim=0.97,
        pants="long",
        palette=dict(
            skin   = (0.769, 0.576, 0.400),
            tee    = (0.937, 0.918, 0.847),   # 生成り
            pants  = (0.200, 0.188, 0.173),
            red    = (0.839, 0.227, 0.196),
            rand   = (0.839, 0.227, 0.196),
            rubber = (0.949, 0.776, 0.196),   # 黄のポイント
            sole   = (0.098, 0.102, 0.110),
        ),
    ),
}
BASE_HEIGHT = CHARACTERS["aito"]["height"]      # 数値を書いてある型の身長
CHAR = "aito"          # いま組んでいる人。色の引き先を決める


def color_of(key):
    """いま組んでいる人の色。その人が持っていなければ共通のパレットから。"""
    return CHARACTERS[CHAR].get("palette", {}).get(key, PALETTE[key])


def srgb_to_linear(c):
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c)

def flat_material(key):
    # 地面・壁・チョークのように全員で同じ色のものは、材質も共有する
    who = CHAR if key in CHARACTERS[CHAR].get("palette", {}) else "aito"
    name = f"{who}_{key}"
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    r, g, b = srgb_to_linear(color_of(key))
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.95
    for k in ("Specular IOR Level", "Specular"):
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = 0.0
            break
    a = ALPHA.get(key, 1.0)
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = a
    if a < 1.0:
        for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
            if hasattr(m, attr):
                try:
                    setattr(m, attr, val)
                    break
                except TypeError:
                    pass
        if hasattr(m, "show_transparent_back"):
            m.show_transparent_back = False
    m.diffuse_color = (r, g, b, a)
    return m

def facet_material():
    """面ごとの色を持たせるので材質は1つで足りる。色はメッシュ側の色属性から来る。"""
    m = bpy.data.materials.get("aito_facet") or bpy.data.materials.new("aito_facet")
    m.use_nodes = True
    nt = m.node_tree
    for n in [n for n in nt.nodes if n.type == "ATTRIBUTE"]:
        nt.nodes.remove(n)
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "facet"
    attr.location = (-300, 0)
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.95
    for k in ("Specular IOR Level", "Specular"):
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = 0.0
            break
    return m

# ---------------------------------------------------------------- 形の部品
def mesh_from(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate(); me.update()
    # 面の向きを外向きに揃える。レンダーは裏返っていても見えるが、
    # STL は法線で内外を判断するので、裏返った殻は穴として扱われる
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    return bpy.data.objects.new(name, me)

def box(name, sx, sy, sz, loc=(0, 0, 0), taper=1.0, shift_top=(0.0, 0.0)):
    hx, hy = sx / 2, sy / 2
    tx, ty = hx * taper, hy * taper
    dx, dy = shift_top
    v = [(-hx, -hy, 0), (hx, -hy, 0), (hx, hy, 0), (-hx, hy, 0),
         (-tx + dx, -ty + dy, sz), (tx + dx, -ty + dy, sz),
         (tx + dx, ty + dy, sz), (-tx + dx, ty + dy, sz)]
    f = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    ob = mesh_from(name, v, f)
    ob.location = loc
    return ob

def limb(name, r_top, r_bot, length, top, sides=6, tilt=(0.0, 0.0)):
    verts = []
    for r, z in ((r_top, 0.0), (r_bot, -length)):
        for i in range(sides):
            a = 2 * math.pi * i / sides + math.pi / sides
            verts.append((r * math.cos(a), r * math.sin(a), z))
    faces = [tuple(range(sides)), tuple(reversed(range(sides, 2 * sides)))]
    for i in range(sides):
        j = (i + 1) % sides
        faces.append((j, i, sides + i, sides + j))
    ob = mesh_from(name, verts, faces)
    ob.location = top
    ob.rotation_euler = (tilt[0], tilt[1], 0.0)
    return ob

def barrel(name, profile, sides=10, loc=(0, 0, 0)):
    verts = []
    for (r, z) in profile:
        for i in range(sides):
            a = 2 * math.pi * i / sides
            verts.append((r * math.cos(a), r * math.sin(a), z))
    rings = len(profile)
    faces = []
    for k in range(rings - 1):
        for i in range(sides):
            j = (i + 1) % sides
            faces.append((k * sides + i, k * sides + j, (k + 1) * sides + j, (k + 1) * sides + i))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple(range((rings - 1) * sides, rings * sides)))
    ob = mesh_from(name, verts, faces)
    ob.location = loc
    return ob


def loft_data(rings, sides=8):
    """(cx, cy, z, rx, ry) の断面を下から順につないだ頂点と面。
    (cx, cy, z, rx, ry_back, ry_front) と6つ書くと、前後で奥行きを変えられる。
    尻のように「前は浅く後ろに張り出す」形は、前後対称の楕円だと作れない。"""
    verts = []
    for ring in rings:
        cx, cy, z, rx, ry_b = ring[0], ring[1], ring[2], ring[3], ring[4]
        ry_f = ring[5] if len(ring) > 5 else ry_b
        for i in range(sides):
            a = 2 * math.pi * i / sides + math.pi / sides
            sa = math.sin(a)
            verts.append((cx + rx * math.cos(a), cy + (ry_b if sa >= 0 else ry_f) * sa, z))
    n = len(rings)
    faces = [tuple(reversed(range(sides))),
             tuple(range((n - 1) * sides, n * sides))]
    for k in range(n - 1):
        for i in range(sides):
            j = (i + 1) % sides
            faces.append((k * sides + i, k * sides + j,
                          (k + 1) * sides + j, (k + 1) * sides + i))
    return verts, faces


def loft(name, rings, sides=8):
    """断面をつないだ筒を1つのメッシュとして返す。"""
    return mesh_from(name, *loft_data(rings, sides))


def tilt_x(ob, pivot, deg):
    """pivot を中心に X 軸まわりへ傾ける。正の角度で後ろ側（+y）が下がる。
    断面を積む作り方だと輪が水平にしか置けないので、傾きは最後に掛ける。

    位置を頂点に持つ部品（loft）と、オブジェクトの原点に持つ部品（box）の
    両方が来るので、頂点は原点まわりに回し、原点は pivot まわりに回す。
    どちらか片方だけだと、box が軸の反対側へ飛ぶ。"""
    q = Matrix.Rotation(math.radians(-deg), 4, "X")
    P = Vector(pivot)
    for v in ob.data.vertices:
        v.co = q @ Vector(v.co)
    ob.location = P + q @ (Vector(ob.location) - P)
    ob.data.update()
    return ob


def ball_data(loc, r, sides=6, rz=None):
    """小さな玉。断面を5枚積んで上下を丸く閉じる。rz を渡すと縦につぶせる。"""
    x, y, z = loc
    h = r if rz is None else rz
    return loft_data([
        (x, y, z - h * 0.92, r * 0.36, r * 0.36),
        (x, y, z - h * 0.58, r * 0.76, r * 0.76),
        (x, y, z,            r,        r),
        (x, y, z + h * 0.58, r * 0.76, r * 0.76),
        (x, y, z + h * 0.92, r * 0.36, r * 0.36),
    ], sides)


def merge_mesh(name, chunks, tags=None):
    """(頂点, 面) をいくつかまとめて1つのメッシュにする。
    パーツを分けたままだと、骨に付けたときに別々に動いて継ぎ目が開く。
    tags を渡すと、どの頂点がどの部分かを覚えておき、ウェイトを部分ごとに塗れる。"""
    verts, faces, ranges = [], [], []
    for k, (vs, fs) in enumerate(chunks):
        off = len(verts)
        verts += list(vs)
        faces += [tuple(i + off for i in f) for f in fs]
        if tags:
            ranges.append((off, len(verts), tags[k]))
    ob = mesh_from(name, verts, faces)
    if tags:
        # ID プロパティは文字列混じりの配列を持てないので、辞書で持つ
        ob["skin_parts"] = {t: [a, b] for (a, b, t) in ranges}
    return ob


def chain_data(pts, sides=8):
    """pts: [((x, y, z), rx, ry)] の関節列をつなぐ筒。断面は進行方向に垂直に立つ。
    肘や膝で折れても断面が潰れないので、ポーズを付けた体はこれで作る。"""
    P = [Vector(pt[0]) for pt in pts]
    n = len(P)
    verts = []
    for i, pt in enumerate(pts):
        p, rx, ry_b = pt[0], pt[1], pt[2]
        ry_f = pt[3] if len(pt) > 3 else ry_b
        if i == 0:
            t = P[1] - P[0]
        elif i == n - 1:
            t = P[-1] - P[-2]
        else:
            t = P[i + 1] - P[i - 1]
        q = t.normalized().to_track_quat("Z", "Y")
        for k in range(sides):
            a = 2 * math.pi * k / sides + math.pi / sides
            sa = math.sin(a)
            ry = ry_b if sa >= 0 else ry_f
            verts.append(tuple(P[i] + q @ Vector((rx * math.cos(a), ry * sa, 0.0))))
    faces = [tuple(reversed(range(sides))), tuple(range((n - 1) * sides, n * sides))]
    for k in range(n - 1):
        for i in range(sides):
            j = (i + 1) % sides
            faces.append((k * sides + i, k * sides + j,
                          (k + 1) * sides + j, (k + 1) * sides + i))
    return verts, faces


def chain_mesh(name, pts, sides=8):
    return mesh_from(name, *chain_data(pts, sides))


def head_frame(chin, crown):
    """顎→頭頂を Z 軸に、顔が -Y 側に来るように組んだ回転。
    to_track_quat("Z", "Y") は軸が後ろに倒れると Y ごと裏返って顔が後頭部に回るので使わない。"""
    z = (Vector(crown) - Vector(chin)).normalized()
    x = Vector((1.0, 0.0, 0.0)) - z * z.x
    if x.length < 1e-6:
        x = Vector((1.0, 0.0, 0.0))
    x.normalize()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed().to_quaternion()


def ring_quat(a, b):
    return (Vector(b) - Vector(a)).normalized().to_track_quat("Z", "Y")


def lerp(a, b, t, off=(0.0, 0.0, 0.0)):
    v = Vector(a).lerp(Vector(b), t) + Vector(off)
    return tuple(v)

# ---------------------------------------------------------------- 仕上げ（作りごと）
def facetize(ob, key, seed):
    """面を割って三角にし、同じ色相のまま面ごとに濃さを散らす。"""
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    me.update()
    for ca in list(me.color_attributes):
        me.color_attributes.remove(ca)
    ca = me.color_attributes.new(name="facet", type="FLOAT_COLOR", domain="CORNER")
    rng = random.Random(seed)
    lin = srgb_to_linear(color_of(key))
    for poly in me.polygons:
        f = rng.uniform(0.74, 1.22)
        c = tuple(min(1.0, v * f) for v in lin)
        for li in poly.loop_indices:
            ca.data[li].color = (c[0], c[1], c[2], 1.0)

# 体と服は粗く溶かして丸め、道具は形が残る細かさにする
ORGANIC_VOXEL = {"red": 0.006, "rubber": 0.006, "rand": 0.006, "sole": 0.006,
                 "cream": 0.009, "canvas": 0.009,
                 "bag_band": 0.009, "bag_body": 0.009,
                 # 短パンは左右の脚のあいだが 3cm ほどしかない。粗いまま溶かすと
                 # そこが埋まってスカートになるので、ここだけ粒を細かくする
                 "pants": 0.013}
# 均す回数。道具は形を残したいので少なく、体と服はよく溶かす。
# 短パンは隙間を残したいので、溶かすが均しは控えめにする
ORGANIC_SMOOTH = {"pants": 8}

def organic_fuse(obs, key, voxel=0.019):
    """同じ材質の部品をひとつに結合し、溶かす修飾子を載せる。適用はまだしない。
    結合では同じ名前の頂点グループが引き継がれるので、先にウェイトを塗ってあれば残る。"""
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()
    merged = bpy.context.view_layer.objects.active
    r = merged.modifiers.new("remesh", "REMESH")
    r.mode = "VOXEL"
    r.voxel_size = ORGANIC_VOXEL.get(key, voxel)
    r.use_smooth_shade = True
    sm = merged.modifiers.new("smooth", "SMOOTH")
    sm.factor = 1.0
    sm.iterations = ORGANIC_SMOOTH.get(key, 4 if key in ORGANIC_VOXEL else 14)
    return merged


def organic_merge(groups, voxel=0.019):
    """材質ごとに部品を結合し、ボクセルで溶かしてから均す。繋ぎ目が消えて1つの体になる。"""
    for key, obs in groups.items():
        obs = [o for o in obs if o.name in bpy.data.objects]
        if obs:
            organic_fuse(obs, key, voxel)


# ---------------------------------------------------------------- 腕の基本姿勢
# 垂直から何度開くか。狭いと手が短パンにめり込み、肩まわりのウェイトも作りにくい
ARM_TILT = math.radians(15.0)
SHOULDER_PT = (0.150, 0.000, 1.370)
UPPERARM_LEN, FOREARM_LEN = 0.285, 0.255


def seg_tilt(a, b):
    """a から b へ向かう向きを limb の tilt_y に直す。
    limb は真下に伸びるので、Y 軸まわりに回せば x-z 面の向きが合う。"""
    d = Vector(b) - Vector(a)
    return math.atan2(-d.x, -d.z)


def arm_points(sgn):
    """肩・肘・手首の位置。sgn は左右（-1 / +1）。
    骨（RIG_BONES）もここを見るので、どの作りの腕もこの位置に合わせる。
    合っていないと、ポーズを付けたときに肘から先だけ置いていかれる。"""
    sh = Vector((sgn * SHOULDER_PT[0], SHOULDER_PT[1], SHOULDER_PT[2]))
    d = Vector((sgn * math.sin(ARM_TILT), 0.0, -math.cos(ARM_TILT)))
    el = sh + d * UPPERARM_LEN + Vector((0.0, 0.006, 0.0))
    wr = sh + d * (UPPERARM_LEN + FOREARM_LEN) + Vector((0.0, 0.012, 0.0))
    return sh, el, wr


# ---------------------------------------------------------------- 手
def _wrist_rest(sgn):
    return tuple(arm_points(sgn)[2])
FINGERS = [("f1", -0.027, 0.052), ("f2", -0.009, 0.060),
           ("f3", 0.009, 0.056), ("f4", 0.027, 0.046)]   # (名前, 手のひら上の位置, 長さ)


def hand_joints(sgn):
    """手首・手のひら・指の関節位置。sgn は左右（-1 / +1）。
    腕が開いているので、手も同じ角度に倒して腕の続きになるようにする。"""
    wx, wy, wz = _wrist_rest(sgn)
    palm_z = wz - 0.058
    j = {"wrist": (wx, wy, wz), "palm": (wx, wy - 0.004, palm_z)}
    # 手のひらは胴体を向く。つまり平たい面は左右（±X）に正対し、
    # 4本の指は前後（±Y）に並ぶ。人差し指が前、小指が後ろ。
    # 前後に正対させると、親指が手の甲側に生えることになって形が破綻する
    for name, dy, L in FINGERS:
        y = wy + dy
        # 基本姿勢では指をまっすぐ開いておく。曲げるのはポーズ側の仕事
        j[name] = [(wx, y, palm_z),
                   (wx - sgn * 0.001, y, palm_z - L * 0.58),
                   (wx - sgn * 0.002, y, palm_z - L)]
    # 親指は手のひらの前の縁から、前へ向かって出る
    j["thumb"] = [(wx - sgn * 0.008, wy - 0.034, wz - 0.026),
                  (wx - sgn * 0.016, wy - 0.058, wz - 0.050),
                  (wx - sgn * 0.021, wy - 0.072, wz - 0.066)]

    ca, sa = math.cos(-sgn * ARM_TILT), math.sin(-sgn * ARM_TILT)
    def tilt(p):
        dx, dz = p[0] - wx, p[2] - wz
        return (wx + dx * ca + dz * sa, p[1], wz - dx * sa + dz * ca)

    out = {}
    for k, v in j.items():
        out[k] = tilt(v) if isinstance(v, tuple) else [tilt(q) for q in v]
    return out


def build_hand(put, side, sgn, sides=8, detail=False):
    """手のひらと指5本を1メッシュにまとめる。
    指を関節ごとに分けて骨に直付けすると、関節と手のひらの境目が切れて見える。
    1メッシュにして指の骨でスキニングすれば、付け根から先までつながる。"""
    j = hand_joints(sgn)
    wx, wy, wz = j["wrist"]
    px, py, pz = j["palm"]
    chunks = [loft_data([
        (wx, wy, wz, 0.018, 0.034),
        (wx, wy - 0.002, wz - 0.026, 0.019, 0.040),
        (px, py, pz + 0.006, 0.018, 0.041),
        (px, py, pz, 0.016, 0.038),
    ], sides)]
    tags = [f"palm_{side}"]

    def finger(name, r0, r1, r2):
        a, b, c = (Vector(q) for q in j[name])
        root = a + (a - b).normalized() * 0.016      # 手のひらの中まで差し込んで隙間を消す
        chunks.append(chain_data([
            (tuple(root), r0 * 1.06, r0 * 1.06),
            (tuple(a), r0, r0),
            (tuple(a.lerp(b, 0.55)), (r0 + r1) * 0.5, (r0 + r1) * 0.5),
            (tuple(b), r1, r1),
            (tuple(b.lerp(c, 0.55)), (r1 + r2) * 0.5, (r1 + r2) * 0.5),
            (tuple(c), r2, r2 * 1.06),
        ], 6))
        tags.append(f"{name}_{side}")

    for name, _dx, _L in FINGERS:
        finger(name, 0.0094, 0.0084, 0.0066)
    finger("thumb", 0.0118, 0.0100, 0.0080)

    put(merge_mesh(f"hand_{side}", chunks, tags), "skin", detail=detail)


# ---------------------------------------------------------------- ポーズ
# 関節の位置（世界座標）で持つ。体の前は -Y。壁は -Y 側に立てる。
POSES = {
    # 垂壁を横に移動している途中。右手を横へ送り、右足を横へ置き換える
    "traverse": dict(
        wall_y=-0.335,
        pelvis=(0.02, -0.075, 1.000),
        waist =(0.02, -0.100, 1.130),
        chest =(0.04, -0.130, 1.320),
        neck  =(0.05, -0.145, 1.420),
        chin  =(0.05, -0.165, 1.505),
        crown =(0.07, -0.120, 1.715),
        shoulder=dict(r=( 0.185, -0.140, 1.380), l=(-0.105, -0.125, 1.375)),
        elbow   =dict(r=( 0.330, -0.175, 1.430), l=(-0.230, -0.120, 1.190)),
        wrist   =dict(r=( 0.455, -0.235, 1.480), l=(-0.190, -0.225, 1.345)),
        tip     =dict(r=( 0.495, -0.272, 1.495), l=(-0.180, -0.272, 1.400)),
        hip     =dict(r=( 0.105, -0.060, 1.000), l=(-0.090, -0.070, 0.990)),
        knee    =dict(r=( 0.300, -0.120, 0.720), l=(-0.135, -0.115, 0.575)),
        ankle   =dict(r=( 0.400, -0.185, 0.500), l=(-0.120, -0.235, 0.215)),
        shoe_rot=dict(r=(math.radians(6), 0.0, math.radians(-16)),
                      l=(math.radians(4), 0.0, math.radians(6))),
        # 手のひらは壁側。右手は横へ送っているぶん、少し内向きに寝かせる
        palm_face={"hand.R": (-0.30, -1.0, -0.20), "hand.L": (0.0, -1.0, -0.25)},
        # 指はホールドに掛かる程度に曲げる。親指は面が違うので別指定
        grip=(44.0, 50.0),
        thumb_grip=(24.0, 18.0),
    ),
    # 次のホールドへ手を伸ばしきる直前。右手はまだ開いていて、ホールドに届いていない。
    # 足で押し切って体が一本の線に伸び切った瞬間。膝も肘もほとんど曲がっていない。
    # 掴んだあとの "reach" は肘を曲げて引きつけた姿なので、そこと対になる
    "precatch": dict(
        wall_y=-0.335,
        pelvis=(0.020, -0.062, 1.060),
        waist =(0.022, -0.088, 1.192),
        chest =(0.035, -0.118, 1.382),
        neck  =(0.042, -0.132, 1.482),
        chin  =(0.042, -0.152, 1.566),
        crown =(0.052, -0.082, 1.782),         # 届いていないホールドを見上げる
        shoulder=dict(r=( 0.158, -0.128, 1.442), l=(-0.130, -0.115, 1.436)),
        # 右腕は伸ばし切る。左腕は体が上がったぶん、下へ伸びる
        elbow   =dict(r=( 0.205, -0.180, 1.720), l=(-0.228, -0.100, 1.230)),
        wrist   =dict(r=( 0.232, -0.248, 2.000), l=(-0.196, -0.212, 1.352)),
        tip     =dict(r=( 0.240, -0.282, 2.080), l=(-0.186, -0.255, 1.412)),
        hip     =dict(r=( 0.100, -0.060, 1.040), l=(-0.100, -0.062, 1.032)),
        # 押し切ったあとなので、両脚とも腿と脛がほぼ一直線
        knee    =dict(r=( 0.150, -0.150, 0.690), l=(-0.155, -0.135, 0.660)),
        ankle   =dict(r=( 0.170, -0.258, 0.340), l=(-0.190, -0.230, 0.270)),
        # つま先立ちで押している
        toe_offset=dict(r=(0.010, -0.085, -0.118), l=(-0.010, -0.080, -0.120)),
        shoe_rot=dict(r=(math.radians(16), 0.0, math.radians(-8)),
                      l=(math.radians(14), 0.0, math.radians(6))),
        # 指はホールドに掛かる程度に曲げる。親指は面が違うので別指定
        grip={"L": (48.0, 54.0), "R": (8.0, 6.0)},
        thumb_grip=(24.0, 18.0),
    ),
    # ランジ。飛んで次のホールドを右手1本で取り、まだ振られている途中。
    # 体は壁から離れて（+y）振り出され、脚は後ろへ流れて上がる。
    # 左手はホールドに無く、振り出した勢いのまま横へ開いている
    "cutloose": dict(
        wall_y=-0.335,
        overhang=30.0,                    # 足が切れるので、寝た壁でないと成り立たない
        # 元の座標がすでに大きく後ろへ倒れているので、ここで起こす。
        # 組み上がりの傾き ≒ 64 − この値。42 で胴が垂直から約22度になる
        body_tilt=42.0,
        tilt_pivot=("tip", "r"),          # 足が壁にないので、掴んでいる手を軸に傾ける
        contacts_only=("hand.R",),        # 取れているのは右手だけ
        # ここの座標は「壁が垂直だったら」の姿。tilt_pose が被り角ぶん寝かせ、
        # そのあと脚だけ股関節で戻す。差し引き、脚は組み上がりで約17°下がり、
        # 胴は約38°後ろへ倒れる。下の数値はそのぶんを見込んで先に起こしてある
        # 手でポーズモードで直したものを read_pose() で読み戻した値。
        # 被り角ぶんの傾きと、脚の戻しはほどいてあるので、ここは
        # 「壁が垂直だったら」の姿。組み上がりで
        # 胴 −14°（壁側）/ 脚 水平から25°下がり / 股関節 129° になる
        pelvis=(+0.055, +0.194, +1.445),
        waist =(+0.056, +0.086, +1.498),
        chest =(+0.058, -0.129, +1.604),
        neck  =(+0.059, -0.236, +1.658),
        chin  =(+0.061, -0.332, +1.730),
        crown =(+0.063, -0.428, +1.929),
        shoulder=dict(r=(+0.208, -0.200, +1.646), l=(-0.089, -0.200, +1.641)),
        elbow   =dict(r=(+0.240, -0.256, +1.923), l=(-0.334, -0.276, +1.517)),
        wrist   =dict(r=(+0.242, -0.372, +2.150), l=(-0.453, -0.402, +1.329)),
        tip     =dict(r=(+0.240, -0.401, +2.201), l=(-0.473, -0.431, +1.284)),
        hip     =dict(r=(+0.153, +0.218, +1.447), l=(-0.043, +0.216, +1.448)),
        knee    =dict(r=(+0.325, +0.554, +1.264), l=(+0.046, +0.555, +1.215)),
        ankle   =dict(r=(+0.458, +0.899, +1.355), l=(+0.114, +0.863, +1.003)),
        toe_offset=dict(r=(+0.031, +0.140, +0.033), l=(+0.000, +0.122, -0.082)),
        shoe_rot=dict(r=(math.radians(-58), 0.0, math.radians(-8)),
                      l=(math.radians(-56), 0.0, math.radians(6))),
        holds=[(0.240, 2.221)],
        # 指はホールドに掛かる程度に曲げる。親指は面が違うので別指定
        grip=(52.0, 58.0),
        thumb_grip=(30.0, 24.0),
        # palm_face は入れない。手首から指先への向きが壁向きに近く、
        # 骨の軸まわりに回しても正面を向かない（かえって逆側の解に回る）
    ),
    # 壁の上でのレスト。左手でホールドを持ち、右手は下ろして腕を振っている。
    # 右足はホールドを踏み、左脚は伸ばしてつま先を壁に擦りつける（スメアリング）。
    # 体は掴んでいる左手の下へ入り、肩は左上がりになる
    "hang": dict(
        wall_y=-0.335,
        tilt_pivot=("tip", "l"),              # 掴んでいる手を軸に傾ける
        contacts_only=("hand.L", "foot.R"),   # ホールドは左手と右足のぶんだけ
        pelvis=(-0.040, -0.055, 1.020),
        waist =(-0.045, -0.080, 1.150),
        chest =(-0.050, -0.105, 1.340),
        neck  =(-0.048, -0.120, 1.440),
        chin  =(-0.045, -0.140, 1.525),
        crown =(-0.040, -0.075, 1.740),
        shoulder=dict(r=( 0.120, -0.105, 1.392), l=(-0.150, -0.112, 1.428)),
        # 左腕は伸ばして体を吊る。右腕は壁から離して真下へ垂らす
        elbow   =dict(r=( 0.175, -0.075, 1.120), l=(-0.196, -0.175, 1.700)),
        wrist   =dict(r=( 0.200, -0.045, 0.880), l=(-0.204, -0.250, 1.962)),
        tip     =dict(r=( 0.205, -0.035, 0.805), l=(-0.200, -0.288, 2.035)),
        hip     =dict(r=( 0.085, -0.048, 1.000), l=(-0.105, -0.050, 0.995)),
        # 右膝ははっきり曲げて、腰より下のホールドに乗せる。
        # 左脚は伸ばし切って下へ流し、つま先だけ壁に当てる
        knee    =dict(r=( 0.215, -0.175, 0.690), l=(-0.185, -0.215, 0.520)),
        ankle   =dict(r=( 0.150, -0.268, 0.415), l=(-0.255, -0.300, 0.090)),
        # 左足はつま先を下へ向けて壁に立てる。踏んでいる右足は前向きのまま
        toe_offset=dict(r=(0.000, -0.115, -0.078), l=(-0.030, -0.070, -0.118)),
        shoe_rot=dict(r=(math.radians(6), 0.0, math.radians(-8)),
                      l=(math.radians(-22), 0.0, math.radians(10))),
        holds=[(-0.200, 2.055), (0.150, 0.385)],
        # 指はホールドに掛かる程度に曲げる。親指は面が違うので別指定
        grip=(50.0, 56.0),
        thumb_grip=(28.0, 22.0),
    ),
    # 地べたに座る。尻を地面につけ、膝を立て、足の裏も地面につける。
    # 腕は後ろに下ろして、手のひらで上体を支える。
    # 骨の長さは決まっていて、関節位置は「どこを向くか」にしか効かない。
    # なので尻・手のひら・靴底が同じ高さで地面に載るよう、向きの方で合わせてある。
    # Blender で手直ししたポーズ。全骨の回転をそのまま持っている。
    # bone_pose があると関節位置から計算した向きは上書きされるので、
    # 下の座標は「腰の位置決め（pelvis）」と読み手への目安として残してあるだけ。
    # 直したいときは Blender でポーズを付け直し、骨の回転を読み出して差し替える。
    "sit": dict(
        pelvis=(0.00,  0.020, 0.105),
        waist =(0.00,  0.097, 0.197),
        chest =(0.00,  0.251, 0.381),
        neck  =(0.01,  0.328, 0.473),
        chin  =(0.01,  0.405, 0.565),
        crown =(0.02,  0.463, 0.777),
        shoulder=dict(r=( 0.155,  0.270, 0.410), l=(-0.155,  0.270, 0.405)),
        elbow   =dict(r=( 0.203,  0.462, 0.208), l=(-0.203,  0.462, 0.208)),
        wrist   =dict(r=( 0.212,  0.638, 0.015), l=(-0.212,  0.638, 0.015)),
        tip     =dict(r=( 0.215,  0.698, 0.012), l=(-0.215,  0.698, 0.012)),
        hip     =dict(r=( 0.100,  0.020, 0.105), l=(-0.100,  0.020, 0.100)),
        knee    =dict(r=( 0.118, -0.395, 0.080), l=(-0.118, -0.395, 0.077)),
        ankle   =dict(r=( 0.124, -0.770, 0.087), l=(-0.124, -0.770, 0.084)),
        toe_offset=(0.0, -0.100, 0.078),
        shoe_rot=dict(r=(math.radians(-8), 0.0, math.radians(-4)),
                      l=(math.radians(-8), 0.0, math.radians(4))),
        bone_pose={
            "pelvis":      ( 0.939908, -0.341429,  0.000000,  0.000000),
            "spine":       ( 0.978372,  0.206853,  0.000000, -0.000000),
            "chest":       ( 0.999136, -0.000000,  0.000000, -0.041569),
            # 顔は水平から +27.5° 上を向く
            "neck":        ( 0.957757, -0.284556, -0.012501,  0.039649),
            "head":        ( 0.981919,  0.187919,  0.000000, -0.022850),
            "shoulder.R":  ( 0.978178, -0.205586, -0.000000, -0.030046),
            "upperarm.R":  ( 0.864304,  0.483843,  0.026243, -0.134854),
            "forearm.R":   ( 0.979917, -0.182002, -0.063558,  0.050979),
            "hand.R":      ( 0.713126,  0.432554, -0.355744, -0.421657),
            "thumba.R":    ( 0.971289,  0.115770,  0.190689, -0.082660),
            "thumbb.R":    ( 0.999229,  0.039260,  0.000000,  0.000000),
            "shoulder.L":  ( 0.960225, -0.278049,  0.000000,  0.025628),
            "upperarm.L":  ( 0.887400,  0.432232,  0.019693,  0.159091),
            "forearm.L":   ( 0.995394, -0.076269,  0.006435, -0.057727),
            "hand.L":      ( 0.593127,  0.477218,  0.531147,  0.371950),
            "thumba.L":    ( 0.996917,  0.078459,  0.000000,  0.000000),
            "thumbb.L":    ( 0.999229,  0.039260,  0.000000,  0.000000),
            "bag":         (-0.939908, -0.341429,  0.000000, -0.000000),
            "thigh.R":     (-0.793942,  0.606650,  0.030060,  0.026983),
            "shin.R":      ( 0.879626,  0.470765,  0.056005,  0.038748),
            "foot.R":      ( 0.985845,  0.167351, -0.000040, -0.010187),
            "thigh.L":     (-0.897164,  0.441051, -0.001619, -0.023860),
            "shin.L":      ( 0.998254,  0.058116, -0.003233, -0.010054),
            "foot.L":      ( 0.963409,  0.268027, -0.000000, -0.002283),
        },
        # 手で決めた高さ。drop_to_ground に任せると手を基準に持ち上がるので、
        # この姿勢では床に対する高さも保存しておく
        ground_z=-0.762,
    ),
    # 力を抜いた立ち姿。右脚に体重を乗せ、骨盤を右上がりに傾ける。
    # 肩は骨盤と逆に傾け（右肩が下がる）、つま先は少し外を向く。
    # 直立の standing と並べたときに、体の預け方の違いが出るようにしている。
    "natural": dict(
        # 上体を少し前へ。重心が足より後ろに来ると、立っていても倒れそうに見える。
        # 頭頂を顎より前に置いて、頭が後ろへ倒れないようにする
        pelvis=(0.020,  0.000, 0.900),
        waist =(0.008, -0.012, 1.030),
        chest =(0.004, -0.032, 1.290),
        neck  =(0.006, -0.040, 1.392),
        chin  =(0.008, -0.050, 1.472),
        crown =(0.010, -0.004, 1.690),   # 顎より後ろに置いて顔を10度上へ
        shoulder=dict(r=( 0.152, -0.004, 1.364), l=(-0.148, -0.004, 1.376)),
        elbow   =dict(r=( 0.222, -0.010, 1.090), l=(-0.218, -0.006, 1.086)),
        wrist   =dict(r=( 0.246, -0.075, 0.852), l=(-0.250, -0.062, 0.848)),
        tip     =dict(r=( 0.244, -0.130, 0.790), l=(-0.248, -0.118, 0.786)),
        hip     =dict(r=( 0.100,  0.012, 0.880), l=(-0.100,  0.012, 0.880)),
        # 遊んでいる左脚は、前と外へ開いて置く。骨の長さが決まっているので、
        # ここを詰めると体重を乗せた右足のほうが浮く（左右差が出る）
        knee    =dict(r=( 0.100,  0.004, 0.460), l=(-0.152, -0.072, 0.474)),
        ankle   =dict(r=( 0.100,  0.014, 0.080), l=(-0.200, -0.135, 0.100)),
        # 基本姿勢の足の骨と同じ角度にするとソールが床と平行になる。
        # ここを急にすると踵が浮く（前は 34〜43mm 浮いていた）
        toe_offset=dict(r=( 0.030, -0.134, -0.060), l=(-0.034, -0.134, -0.060)),
        shoe_rot=dict(r=(0.0, 0.0, math.radians(-9)),
                      l=(0.0, 0.0, math.radians(11))),
    ),
    # 次のホールドへ手を伸ばす。右手を上げ切り、左手は胸の高さを持って体を伸ばす。
    # hang（ぶら下がる）・climb（足を上げる）と並べて、動きの段階が分かるようにしている。
    "reach": dict(
        wall_y=-0.335,
        pelvis=(0.00, -0.070, 0.980),
        waist =(0.00, -0.095, 1.110),
        chest =(0.02, -0.125, 1.300),
        neck  =(0.03, -0.140, 1.400),
        chin  =(0.03, -0.160, 1.485),
        crown =(0.045, -0.078, 1.700),         # 伸ばした手を見上げる
        shoulder=dict(r=( 0.150, -0.135, 1.360), l=(-0.135, -0.125, 1.352)),
        # 掴んだあと。右肘を曲げて引きつけている（precatch の伸び切った姿と対）
        elbow   =dict(r=( 0.238, -0.168, 1.588), l=(-0.250, -0.170, 1.180)),
        wrist   =dict(r=( 0.216, -0.248, 1.845), l=(-0.215, -0.238, 1.350)),
        tip     =dict(r=( 0.212, -0.285, 1.918), l=(-0.208, -0.278, 1.412)),
        hip     =dict(r=( 0.100, -0.060, 0.960), l=(-0.100, -0.060, 0.952)),
        knee    =dict(r=( 0.150, -0.150, 0.560), l=(-0.150, -0.145, 0.548)),
        ankle   =dict(r=( 0.128, -0.232, 0.200), l=(-0.126, -0.238, 0.170)),
        shoe_rot=dict(r=(math.radians(10), 0.0, math.radians(-8)),
                      l=(math.radians(10), 0.0, math.radians(8))),
        holds=[(0.220, 2.020), (-0.206, 1.430), (0.128, 0.170), (-0.126, 0.140)],
        # 伸ばした手も掴んだ手も、手のひらは壁側
        palm_face={"hand.R": (0.0, -1.0, -0.10), "hand.L": (0.0, -1.0, -0.25)},
        # 指はホールドに掛かる程度に曲げる。親指は面が違うので別指定
        grip=(46.0, 52.0),
        thumb_grip=(26.0, 20.0),
    ),
    "climb": dict(
        wall_y=-0.335,
        pelvis=(0.00, -0.075, 1.020),
        waist =(0.00, -0.100, 1.150),
        chest =(0.02, -0.130, 1.335),
        neck  =(0.03, -0.145, 1.435),
        chin  =(0.03, -0.165, 1.520),
        crown =(0.04, -0.085, 1.735),          # 後ろに倒して、次のホールドを見上げる
        shoulder=dict(r=( 0.155, -0.140, 1.395), l=(-0.130, -0.125, 1.385)),
        elbow   =dict(r=( 0.275, -0.195, 1.605), l=(-0.210, -0.165, 1.248)),
        wrist   =dict(r=( 0.245, -0.255, 1.890), l=(-0.206, -0.228, 1.388)),
        tip     =dict(r=( 0.230, -0.288, 1.960), l=(-0.202, -0.274, 1.447)),
        hip     =dict(r=( 0.100, -0.065, 1.000), l=(-0.100, -0.065, 0.990)),
        knee    =dict(r=( 0.352, -0.108, 0.895), l=(-0.155, -0.118, 0.580)),
        ankle   =dict(r=( 0.245, -0.168, 0.795), l=(-0.112, -0.238, 0.225)),
        shoe_rot=dict(r=(math.radians(8), 0.0, math.radians(-12)),
                      l=(math.radians(4), 0.0, math.radians(7))),
        holds=[(0.230, 1.985), (-0.200, 1.455), (0.245, 0.765), (-0.110, 0.195)],
        # ホールドを握るので手のひらは壁側（-y）へ。指定しないと軸回転がなりゆきで
        # 決まり、手のひらが外を向いて親指が逆側に来る
        palm_face={"hand.R": (0.0, -1.0, -0.25), "hand.L": (0.0, -1.0, -0.25)},
        # 指はホールドに掛かる程度に曲げる。親指は面が違うので別指定
        grip=(46.0, 52.0),
        thumb_grip=(26.0, 20.0),
    ),
}


def build_posed(put, sides, J, shoe, eyes, box_fn):
    """関節の位置から体を組む。立ち姿の版と違い、肘や膝で折れる。"""
    def P(k, s):
        return J[k][s]

    pants_chunks = []
    # 脚。膝の下にふくらはぎの膨らみを1点入れる
    for s in ("l", "r"):
        hip, knee, ank = P("hip", s), P("knee", s), P("ankle", s)
        calf = lerp(knee, ank, 0.30, (0.0, 0.030, 0.0))
        put(chain_mesh(f"leg_{s}", [
            (hip, 0.094, 0.100),
            (lerp(hip, knee, 0.45), 0.072, 0.079),
            (knee, 0.052, 0.058),
            (calf, 0.057, 0.063),
            (ank, 0.034, 0.039),
        ], sides), "skin")
        pants_chunks.append(chain_data([
            (lerp(hip, knee, -0.16), 0.099, 0.102),
            (lerp(hip, knee, -0.03), 0.106, 0.107),
            (lerp(hip, knee, 0.20), 0.106, 0.108),
            (lerp(hip, knee, 0.44), 0.101, 0.104),
            (lerp(hip, knee, 0.64), 0.094, 0.098),
        ], sides))

    pants_chunks.append(chain_data([
        (lerp(J["pelvis"], J["waist"], -1.45), 0.200, 0.086, 0.070),
        (lerp(J["pelvis"], J["waist"], -1.16), 0.198, 0.118, 0.073),
        (lerp(J["pelvis"], J["waist"], -0.87), 0.192, 0.134, 0.076),
        (lerp(J["pelvis"], J["waist"], -0.52), 0.178, 0.114, 0.075),
        (lerp(J["pelvis"], J["waist"], -0.12), 0.161, 0.094, 0.071),
        (lerp(J["pelvis"], J["waist"], 0.25), 0.140, 0.081, 0.065),
        (lerp(J["pelvis"], J["waist"], 0.52), 0.144, 0.083, 0.067),
    ], sides))
    put(merge_mesh("pants", pants_chunks,
                   ["pants_leg_l", "pants_leg_r", "pants_hip"]), "pants")

    put(chain_mesh("tee", [
        (lerp(J["pelvis"], J["waist"], -0.35), 0.161, 0.112),
        (J["waist"], 0.167, 0.115),
        (J["chest"], 0.170, 0.112),
        (lerp(J["chest"], J["neck"], 0.75), 0.150, 0.100),
        (J["neck"], 0.110, 0.078),
    ], sides), "tee")

    for s in ("l", "r"):
        sh, el, wr, tp = P("shoulder", s), P("elbow", s), P("wrist", s), P("tip", s)
        put(chain_mesh(f"arm_{s}", [
            (sh, 0.055, 0.058),
            (lerp(sh, el, 0.55), 0.049, 0.051),
            (el, 0.046, 0.048),
            (lerp(el, wr, 0.55), 0.040, 0.042),
            (wr, 0.033, 0.036),
            (tp, 0.026, 0.030),
        ], sides), "skin")
        put(chain_mesh(f"sleeve_{s}", [
            (lerp(sh, el, -0.24), 0.077, 0.083),
            (lerp(sh, el, 0.10), 0.075, 0.079),
            (lerp(sh, el, 0.42), 0.066, 0.069),
        ], sides), "tee")

    put(chain_mesh("neck", [
        (lerp(J["chest"], J["neck"], 0.55), 0.058, 0.063),
        (J["neck"], 0.053, 0.058),
        (J["chin"], 0.054, 0.059),
    ], sides), "skin")

    chin, crown = J["chin"], J["crown"]
    put(chain_mesh("head", [
        (chin, 0.050, 0.056),
        (lerp(chin, crown, 0.19), 0.071, 0.079),
        (lerp(chin, crown, 0.43), 0.078, 0.086),
        (lerp(chin, crown, 0.70), 0.074, 0.082),
        (lerp(chin, crown, 0.91), 0.049, 0.055),
        (crown, 0.021, 0.025),
    ], sides), "skin")

    q = head_frame(chin, crown)
    back = q @ Vector((0.0, 0.020, 0.0))
    put(chain_mesh("hair", [
        (tuple(Vector(lerp(chin, crown, 0.42)) + back), 0.076, 0.080),
        (tuple(Vector(lerp(chin, crown, 0.61)) + back * 0.6), 0.080, 0.086),
        (lerp(chin, crown, 0.80), 0.071, 0.078),
        (lerp(chin, crown, 0.94), 0.049, 0.055),
        (lerp(chin, crown, 1.04), 0.022, 0.026),
    ], sides), "hair")

    def hb(t, dy, rx, ry):
        return (tuple(Vector(lerp(chin, crown, t)) + q @ Vector((0.0, dy, 0.0))), rx, ry)

    put(chain_mesh("hair_back", [
        hb(0.20, 0.050, 0.056, 0.036),
        hb(0.41, 0.044, 0.068, 0.048),
        hb(0.64, 0.034, 0.073, 0.057),
        hb(0.86, 0.018, 0.062, 0.054),
        hb(0.97, 0.004, 0.038, 0.036),
    ], sides), "hair")

    if eyes:
        base = Vector(lerp(chin, crown, 0.455))
        for s, sg in (("l", -1), ("r", 1)):
            e = box_fn(f"eye_{s}", 0.016, 0.010, 0.016,
                       loc=tuple(base + q @ Vector((sg * 0.038, -0.076, -0.008))))
            e.rotation_euler = q.to_euler()
            put(e, "hair", detail=True)

    for s, sg in (("l", -1), ("r", 1)):
        shoe(s, sg, base=P("ankle", s), rot=J["shoe_rot"][s])

    # 壁とホールド
    wy = J.get("wall_y")
    if wy is not None:
        put(box_fn("wall", 2.40, 0.12, 2.70, loc=(0.0, wy - 0.06, 0.0)), "wall")
        for i, (hx, hz) in enumerate(J.get("holds", [])):
            put(box_fn(f"hold_{i}", 0.098, 0.052, 0.078,
                       loc=(hx, wy + 0.026, hz - 0.038), taper=0.55), "hold", detail=True)

# ---------------------------------------------------------------- 頭の形
# 顎を原点に、(cy, dz, rx, ry) の断面を下から積む。cy は奥行き方向のずらし（+y が後ろ）、
# dz は顎からの高さ、rx が左右の半径、ry が前後の半径。
# eye は (顎からの高さ, 前への出, 左右のずれ, 目の一辺)。
#
#   long   写真どおりの細長い頭。顎が絞れて面長に出る
#   round  丸顔。頭を低く広くして顎を丸く閉じ、目を下寄りに大きく置く
HEAD_SHAPES = {
    "long": dict(
        head=[
            (0.006, 0.000, 0.050, 0.056),
            (0.003, 0.042, 0.071, 0.079),
            (0.000, 0.096, 0.078, 0.086),
            (-0.002, 0.156, 0.074, 0.082),
            (0.000, 0.204, 0.049, 0.055),
            (0.000, 0.224, 0.021, 0.025),
        ],
        hair=[
            (0.020, 0.094, 0.076, 0.080),
            (0.012, 0.138, 0.080, 0.086),
            (0.002, 0.180, 0.071, 0.078),
            (0.000, 0.212, 0.049, 0.055),
            (0.000, 0.227, 0.022, 0.026),
        ],
        back=[
            (0.050, 0.046, 0.056, 0.036),
            (0.044, 0.092, 0.068, 0.048),
            (0.034, 0.144, 0.073, 0.057),
            (0.018, 0.192, 0.062, 0.054),
            (0.004, 0.216, 0.038, 0.036),
        ],
        eye=(0.102, -0.079, 0.038, 0.016),
        eye_yaw=0.0,
    ),
    # 顎を尖らせないために、顎より下に小さい断面をもう1枚置いて丸く閉じる。
    # 高さ 0.196 に対して幅 0.190。細長い方（0.224 / 0.156）と違ってほぼ正方形。
    # 髪は生え際をこめかみまで下ろす。顔の面積が減るぶん幼く見える。
    "round": dict(
        head=[
            (0.004, -0.010, 0.046, 0.050),   # 顎の下。ここで丸く閉じる
            (0.004, 0.008, 0.076, 0.082),    # 顎。ここを急に広げないと首と一続きの円錐になる
            (0.003, 0.034, 0.088, 0.094),    # 頬
            (0.001, 0.064, 0.095, 0.101),    # いちばん張るところ。目の高さ
            (-0.001, 0.104, 0.094, 0.100),
            (-0.002, 0.142, 0.081, 0.087),
            (0.000, 0.170, 0.051, 0.057),
            (0.000, 0.186, 0.020, 0.024),
        ],
        hair=[
            (0.022, 0.046, 0.092, 0.095),    # 生え際。こめかみまで下ろす
            (0.016, 0.082, 0.100, 0.104),
            (0.008, 0.120, 0.099, 0.104),
            (0.002, 0.156, 0.083, 0.089),
            (0.000, 0.180, 0.052, 0.058),
            (0.000, 0.194, 0.021, 0.026),
        ],
        back=[
            (0.056, 0.026, 0.064, 0.042),
            (0.050, 0.064, 0.084, 0.058),
            (0.038, 0.108, 0.092, 0.068),
            (0.020, 0.150, 0.078, 0.068),
            (0.004, 0.182, 0.046, 0.042),
        ],
        eye=(0.058, -0.086, 0.036, 0.026),   # 頭の下から4割の高さ。細長い方よりずっと大きい
        # 目の幅ぶんだけ顔は横に逃げていくので、そのぶん目の板を外へ振る。
        # 振らないと内側の角が顔に埋まって、目が小さく欠けて見える
        eye_yaw=0.40,
    ),
}


def curl_chunks(shape, hring, hk, seed=11, size=1.0, thick=0.017):
    """天然パーマ。頭の形に沿って玉を散らし、輪郭を粒立たせる。
    低ポリなので毛を1本ずつ作らず、塊のかたまりとして見せる。

    髪は頭皮に生えているので、髪用の殻ではなく頭そのものの断面（shape["head"]）を
    使い、そこから髪の厚み thick ぶん外へ出した面の上に置く。
    生え際から上は全周、生え際より下は後ろ側だけ（襟足）。

    同じ大きさの玉を等間隔に並べると数珠に見えるので、角度・大きさ・
    殻から出る量・高さを一つずつ散らす。
    size は粒の大きさの倍率。小さくするときは列も一緒に増やす。
    数だけ増やすと横は詰まるが列と列のあいだが開き、玉が離れて見える。"""
    rng = random.Random(seed)
    chunks = []
    skull = shape["head"]
    front_dz = shape["hair"][0][1]            # 生え際の高さ
    top_dz = skull[-1][1]
    nape_dz = front_dz - 0.042                # 襟足。短く見せるためここで止める

    def at(dz):
        """頭の断面を高さ dz で取る。(中心y, 横半径, 前後半径)"""
        for a, b in zip(skull, skull[1:]):
            if a[1] <= dz <= b[1]:
                u = (dz - a[1]) / ((b[1] - a[1]) or 1.0)
                return tuple(a[m] + (b[m] - a[m]) * u for m in (0, 2, 3))
        e = skull[-1] if dz > skull[-1][1] else skull[0]
        return (e[0], e[2], e[3])

    step = 0.019 * size                       # 列の間隔。粒に合わせて細かくする
    dz = nape_dz
    while dz <= top_dz + step * 0.5:
        cy, rx, ry = at(min(dz, top_dz))
        _, y0, z0, RX, RY = hring(cy, dz, rx + thick, ry + thick)
        # 襟足に向かって粒を小さくする。刈り上げた印象になる
        taper = min(1.0, 0.45 + 0.55 * (dz - nape_dz) / 0.060)
        r_typ = 0.021 * size * taper * hk
        k = max(4, int(math.ceil(math.pi * (RX + RY) / (1.45 * r_typ))))
        phase = rng.uniform(0.0, 2 * math.pi)
        for m in range(k):
            a = phase + 2 * math.pi * (m + rng.uniform(-0.42, 0.42)) / k
            back, front = math.sin(a) > 0.15, math.sin(a) < -0.45
            if dz < front_dz and not back:     # 生え際より下は後ろだけ
                continue
            # 目は生え際の少し上（顎から 0.102〜0.118）にある。
            # 玉の半径ぶん下へ届くので、そのぶん上で切る
            if dz < front_dz + 0.045 and front:
                continue
            big = rng.random() < 0.32
            r = (rng.uniform(0.026, 0.034) if big
                 else rng.uniform(0.015, 0.023)) * size
            out = rng.uniform(-0.25, 0.60)     # 殻からどれだけ出るか。負なら沈む
            dz_j = rng.uniform(-0.5, 0.5) * step
            if dz < front_dz + 0.085 and front:
                # 額に掛かる粒は小さく、殻へ沈めて、上へだけ振る。
                # 出っぱらせると一つずつ離れて、生え際が点々になる
                r = min(r, 0.019 * size)
                out = rng.uniform(-0.35, 0.15)
                dz_j = abs(dz_j)
            r *= hk * taper
            chunks.append(ball_data(
                (math.cos(a) * (RX + r * out),
                 y0 + math.sin(a) * (RY + r * out),
                 z0 + dz_j),
                r, 6, rz=r * rng.uniform(0.78, 1.05)))
        dz += step
    # 頭頂。輪が小さくなりきるので、そこだけ1つ足して穴を塞ぐ
    cy, rx, ry = at(top_dz)
    _, y0, z0, RX, RY = hring(cy, top_dz, rx + thick, ry + thick)
    chunks.append(ball_data((0.0, y0, z0 + 0.010 * hk),
                            0.024 * size * hk, 6))
    return chunks


def build_head(put, conf, sides, chin_z):
    """顎の高さを軸に、断面を積んだ頭・髪・後頭部を置く。返すのは目の置き場所。"""
    hk = conf.get("head_scale", 1.0)
    # 顎を首に沈める量。頭を大きくすると首が伸びて見えるので、そのぶん下げる
    chin_z -= conf.get("chin_drop", 0.0)
    shape = HEAD_SHAPES[conf.get("head_shape", "long")]
    # 頭だけ分割を増やせる。丸顔は断面の角が立つと台無しになる
    hsides = conf.get("head_sides", sides)

    def hring(cy, dz, rx, ry):
        return (0, cy * hk, chin_z + dz * hk, rx * hk, ry * hk)

    put(loft("head", [hring(*r) for r in shape["head"]], hsides), "skin")
    put(loft("hair", [hring(*r) for r in shape["hair"]], hsides), "hair")
    # 後頭部。頭の軸より後ろに寄せた扁平な断面を積んで、うなじまで覆う
    put(loft("hair_back", [hring(*r) for r in shape["back"]], hsides), "hair")
    style = CHARACTERS[CHAR].get("hair")
    if style == "curly":
        put(merge_mesh("hair_curl", curl_chunks(
            shape, hring, hk, size=CHARACTERS[CHAR].get("curl_size", 1.0))),
            "hair", detail=True)
    elif style == "bob":
        bob_hair(put, shape, hring, hk, hsides, chin_z)
    dz, dy, dx, w = shape["eye"]
    # organic は voxel で溶かすときに肌が一回り痩せるので、そのぶん目を奥に下げる。
    # 下げないと目の箱が顔から浮いて、横から見たときに隙間が見える
    dy += conf.get("eye_push", 0.0)
    return dict(y=dy * hk, z=chin_z + dz * hk, s=hk, dx=dx, w=w,
                yaw=shape.get("eye_yaw", 0.0))


# ---------------------------------------------------------------- 本体
# 結合を後回しにしたとき、どの部品がどの材質の塊になるかを呼び出し側に渡す控え
ORGANIC_GROUPS = {}


# 人に合わせて縮めないもの。道具と背景は誰が持っても同じ大きさ
SHAPE_KEEP = ("chalk_", "wall", "hold_", "ground")


def body_scale(ch):
    """(横, 奥行き, 高さ) の倍率。型どおりの aito なら (1, 1, 1)。"""
    w = ch.get("slim", 1.0)
    return w, w, ch.get("height", BASE_HEIGHT) / BASE_HEIGHT


def group_under_empty(coll, name, parts, loc, size=0.06):
    """部品を1つの空オブジェクトの子にして、まとめて動かせるようにする。
    親を付けてから matrix_world を入れ直すので、見た目の位置は変わらない。
    靴の shoe_pivot、壁の wall_pivot と同じ作法。"""
    pivot = bpy.data.objects.new(name, None)
    coll.objects.link(pivot)
    pivot.empty_display_type = "PLAIN_AXES"
    pivot.empty_display_size = size
    pivot.location = loc
    base = Vector(loc)
    for ob in parts:
        # 頂点を持ち手の原点基準に直す。子の位置が「持ち手からの相対」で入るので、
        # あとでコレクション参照のマスターへそのまま移せる。
        # 見た目の位置は変わらない（引いたぶんを持ち手が持っている）
        off = Vector(ob.location) - base
        for v in ob.data.vertices:
            v.co = Vector(v.co) + off
        ob.data.update()
        ob.location = (0.0, 0.0, 0.0)
        ob.parent = pivot
    return pivot


def shape_body(coll, ch):
    """組み上がった体を、その人の身長と太さに縮める。
    形の数値は1人ぶんしか書いていないので、最後にまとめて縮めて体格の差を出す。"""
    sx, sy, sz = body_scale(ch)
    if (sx, sy, sz) == (1.0, 1.0, 1.0):
        return
    for ob in coll.objects:
        if any(ob.name.split(".")[0].startswith(k) for k in SHAPE_KEEP):
            continue
        ob.location = (ob.location.x * sx, ob.location.y * sy, ob.location.z * sz)
        if ob.type != "MESH":
            continue
        for v in ob.data.vertices:
            v.co = (v.co.x * sx, v.co.y * sy, v.co.z * sz)
        ob.data.update()


def build(preset="blocky", origin_x=0.0, coll_name=None, merge=True, character="aito",
          park=True):
    """coll_name を渡すと別のコレクションに作る。
    同じ preset を2体置くときに、同名コレクションが消されるのを避けるため。
    merge=False にすると organic の結合をせず、材質ごとの部品の一覧を
    ORGANIC_GROUPS に残す。骨を入れるときは部品のままウェイトを塗りたいので使う。"""
    global CHAR
    CHAR = character
    ch = CHARACTERS[character]
    conf = PRESETS[preset]
    style = conf["style"]
    hk = conf.get("head_scale", 1.0)      # 頭の倍率。顎の位置を軸に拡大する
    eyes = conf.get("eyes", True)
    pose = conf.get("pose")            # None なら立ち姿
    name = coll_name or make_coll_name("tmp", character, preset, "stand")
    old = bpy.data.collections.get(name)
    if old:
        for ob in list(old.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(old)
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)

    sides = {"blocky": 6, "facet": 8, "organic": 10}[style]
    # 道具の断面も作りに合わせる。体が6面なのにチョークバケツだけ12面だと、
    # そこだけ別の作りのものが置いてあるように見える
    gear_sides = {"blocky": 6, "facet": 9, "organic": 14}[style]
    # facet は箱の積み上げだと四角く見えるので、断面をつないだ体にする
    form = "sculpt" if style == "facet" else "box"
    facet_mat = facet_material() if style == "facet" else None
    counter = [0]
    groups = {}

    def put(ob, key, detail=False):
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        coll.objects.link(ob)
        ob.data.materials.clear()
        counter[0] += 1
        # 半透明にするものは面ごとの色を持たせず、専用の材質を使う
        if style == "facet" and key not in ALPHA:
            facetize(ob, key, seed=counter[0] * 977 + len(ob.name))
            ob.data.materials.append(facet_mat)
            for p in ob.data.polygons:
                p.use_smooth = False
        else:
            ob.data.materials.append(flat_material(key))
            if style == "organic":
                for p in ob.data.polygons:
                    p.use_smooth = True
                if not detail:
                    groups.setdefault(key, []).append(ob)
            else:
                for p in ob.data.polygons:
                    p.use_smooth = False
        return ob

    # 骨格の高さ
    H, ANKLE, KNEE, CROTCH = 1.72, 0.080, 0.460, 0.860
    WAIST, CHEST, SHOULDER, NECK, CHIN = 1.040, 1.300, 1.380, 1.430, 1.510
    STANCE = 0.098          # 足の左右の開き。体の前は -Y

    # 裾の高さ。短パンは膝の上、長ズボンはくるぶしの上
    HEM = KNEE + 0.085 if ch["pants"] == "short" else 0.120

    if pose is not None:
        pass
    elif form == "box":
        for side, sgn in (("l", -1), ("r", 1)):
            put(limb(f"thigh_{side}", 0.092, 0.074, CROTCH - KNEE, (sgn * STANCE, 0, CROTCH), sides), "skin")
            put(limb(f"shin_{side}", 0.074, 0.054, KNEE - ANKLE, (sgn * STANCE, 0, KNEE), sides), "skin")
        # 奥行きは脚の筒（前面 -0.108）より深く取る。浅いと股の前側が埋まらず、
        # 左右の脚のあいだからTシャツが見えて、裾に切れ込みが入る
        put(box("pants_hip", 0.310, 0.232, 0.215, loc=(0, 0, CROTCH - 0.012), taper=0.90), "pants")
        for side, sgn in (("l", -1), ("r", 1)):
            # 脚の中心より 8mm 外へ出し、裾に向けて絞る。こうしないと左右の
            # 内側が 4mm しか離れず、organic で溶かしたときにくっついて
            # スカートになる。腿（裾の位置で半径 0.078）は覆ったまま
            put(limb(f"pants_leg_{side}", 0.108, 0.090, CROTCH + 0.030 - HEM,
                     (sgn * (STANCE + 0.008), 0, CROTCH + 0.030), sides), "pants")
    else:
        for side, sgn in (("l", -1), ("r", 1)):
            x = sgn * STANCE
            # 細い足首、後ろに張ったふくらはぎ、絞れた腿。クライマーの脚に寄せる
            put(loft(f"leg_{side}", [
                (x, 0.016, 0.020, 0.028, 0.032),
                (x, 0.015, 0.062, 0.032, 0.037),
                (x, 0.016, 0.155, 0.038, 0.044),
                (x, 0.022, 0.255, 0.052, 0.063),
                (x, 0.018, 0.330, 0.050, 0.060),
                (x * 1.02, 0.006, 0.405, 0.044, 0.048, 0.052),
                (x * 1.02, 0.002, 0.436, 0.049, 0.048, 0.064),   # 膝頭の立ち上がり
                (x * 1.02, 0.000, KNEE, 0.053, 0.049, 0.078),    # 膝頭。前だけ張り出す
                (x * 1.02, 0.000, 0.492, 0.055, 0.053, 0.066),   # 膝の上で急に引く
                (x * 1.02, 0.002, 0.545, 0.064, 0.070, 0.070),
                (x * 1.01, 0.006, 0.660, 0.076, 0.084),
                (x, 0.010, 0.775, 0.086, 0.094),
                (x, 0.012, 0.815, 0.089, 0.095),
            ], sides), "skin")
        # Tシャツの内側に入る部分は、面の中点が内側にくるぶんだけ細くしないと貫通する
        # 短パンは1メッシュ。分けておくと骨に付けたとき別々に動いて継ぎ目が開く。
        # 腰は尻の側（+y）を張らせ、腿は外へ少し広がって裾で締まる形にする。
        # 腰の殻の下端と、腿の筒の上端の「外側の幅」を揃える。
        # ずれているとそこに段差の線が出て、2つの塊が重なって見える。
        # 後ろ（+y）だけ張り出させる。前は骨盤の浅さ、後ろは尻の丸みで別々に決める
        chunks = [loft_data([
            (0, 0.000, 0.784, 0.200, 0.086, 0.070),   # 股下。尻はまだ出ていない
            (0, 0.000, 0.822, 0.198, 0.118, 0.073),   # 尻の下の返し
            (0, 0.000, 0.860, 0.192, 0.134, 0.076),   # いちばん張るところ
            (0, 0.000, 0.906, 0.178, 0.114, 0.075),
            (0, 0.000, 0.958, 0.161, 0.094, 0.071),
            (0, 0.000, 1.006, 0.140, 0.081, 0.065),   # ウエスト
            (0, 0.000, 1.040, 0.144, 0.083, 0.067),   # ベルトぶんの返し
        ], sides)]
        for sgn in (-1, 1):
            x = sgn * 0.094
            if ch["pants"] == "short":
                lower = [
                    (x * 1.10, 0.002, HEM, 0.094, 0.098),      # 裾。すこし外へ開いて締まる
                    (x * 1.07, 0.005, HEM + 0.070, 0.101, 0.104),
                ]
            else:
                # 少しダボついた長ズボン。脚（足首で半径 0.03）よりだいぶ太く取り、
                # ふくらはぎで膨らませて膝で軽く絞る。裾は靴の上でたまる
                # 膝の前後に幅を持たせた、まっすぐ落ちるシルエット。
                # 腿から裾までほとんど細らせないので、膝の位置が形に出ない
                lower = [
                    (x * 1.18, -0.006, HEM, 0.068, 0.078),     # 裾。靴の履き口にかぶせる
                    (x * 1.18,  0.000, 0.240, 0.082, 0.094),
                    (x * 1.18,  0.002, 0.350, 0.094, 0.106),   # ふくらはぎ
                    # 膝頭は前（-y）へ 0.078 張り出す。中心を前へ出して幅も取り、
                    # 膝が服を突き抜けて線が出るのを防ぐ
                    (x * 1.16, -0.008, 0.470, 0.100, 0.114),   # 膝。いちばん広い
                    (x * 1.12,  0.002, 0.600, 0.100, 0.110),
                    (x * 1.08,  0.005, 0.700, 0.103, 0.106),
                ]
            chunks.append(loft_data(lower + [
                (x * 1.03, 0.009, 0.752, 0.106, 0.108),        # 腿のいちばん太いところ
                (x * 1.00, 0.013, 0.800, 0.106, 0.107),        # 外側 0.200 = 腰の殻の下端
                (x * 0.96, 0.015, 0.856, 0.099, 0.102),        # 腰の殻の内側に入れて逃がす
            ], sides))
        put(merge_mesh("pants", chunks,
                       ["pants_hip", "pants_leg_l", "pants_leg_r"]), "pants")

    # クライミングシューズ
    def shoe(side, sgn, base=None, rot=None):
        """base を渡すと、その位置に空オブジェクトを立てて靴一式をぶら下げる。
        渡さなければ従来どおり立ち姿の足元に置く。"""
        L, W, T = 0.268, 0.094, 0.066
        ox = 0.0 if base is not None else sgn * STANCE
        # 踵は靴の後ろ端。足首（原点）の少し後ろに置き、そこから前へ靴が伸びる
        heel, toe = L * 0.23, -L * 0.77
        v = [(-W / 2, heel, 0.014), (W / 2, heel, 0.014),
             (-W / 2, -L * 0.10, 0.004), (W / 2, -L * 0.10, 0.004),
             (-W / 2 * 0.66, toe, -0.010), (W / 2 * 0.66, toe, -0.010),
             (-W / 2, heel, T), (W / 2, heel, T),
             (-W / 2 * 0.98, -L * 0.10, T * 0.86), (W / 2 * 0.98, -L * 0.10, T * 0.86),
             (-W / 2 * 0.54, toe, 0.020), (W / 2 * 0.54, toe, 0.020)]
        f = [(0, 1, 3, 2), (2, 3, 5, 4), (9, 8, 6, 7), (11, 10, 8, 9),
             (6, 8, 2, 0), (8, 10, 4, 2), (1, 3, 9, 7), (3, 5, 11, 9),
             (7, 6, 0, 1), (10, 11, 5, 4)]
        loc = (ox, 0.012, 0.0)
        parts = []
        parts.append(put(mesh_from(f"shoe_upper_{side}", v, f), "red")); parts[-1].location = loc
        # ソールの上端。高いほど横から黒が見える。甲を下から食うので人ごとに決める
        top = ch.get("sole_top", 0.004)
        out = 1.04 if top <= 0.008 else 1.07
        sole = [(x * out, y, z - 0.012) for (x, y, z) in v[:6]] + \
               [(x * out, y, z + top) for (x, y, z) in v[:6]]
        parts.append(put(mesh_from(f"shoe_sole_{side}", sole, f), "sole")); parts[-1].location = loc
        tv = [(-W / 2 * 1.02, -L * 0.10, -0.004), (W / 2 * 1.02, -L * 0.10, -0.004),
              (-W / 2 * 0.68, toe - 0.004, -0.014), (W / 2 * 0.68, toe - 0.004, -0.014),
              (-W / 2 * 1.02, -L * 0.10, T * 0.62), (W / 2 * 1.02, -L * 0.10, T * 0.62),
              (-W / 2 * 0.56, toe - 0.004, 0.024), (W / 2 * 0.56, toe - 0.004, 0.024)]
        parts.append(put(mesh_from(f"shoe_toe_{side}", tv,
                      [(0, 1, 3, 2), (7, 6, 4, 5), (4, 6, 2, 0), (1, 3, 7, 5),
                       (5, 4, 0, 1), (6, 7, 3, 2)]), "rand"))
        parts[-1].location = loc
        parts.append(put(box(f"shoe_heel_{side}", W * 1.02, 0.056, T * 0.96,
                loc=(ox, 0.012 + heel - 0.056, 0.004), taper=0.88), "rand"))
        parts.append(put(box(f"shoe_strap_{side}", W * 1.08, 0.028, T * 0.46,
                loc=(ox, 0.012 - L * 0.14, T * 0.52), taper=0.94), "rubber", detail=True))
        parts.append(put(box(f"shoe_tab_{side}", 0.024, 0.013, 0.048,
                loc=(ox, 0.012 + heel - 0.004, T * 0.80)), "rubber", detail=True))

        # 履き口。足首を包む筒。ここが無いと足が靴に乗っているだけに見える
        parts.append(put(loft(f"shoe_collar_{side}", [
            (ox, 0.012 + 0.010, T * 0.48, 0.050, 0.058),
            (ox, 0.012 + 0.008, T * 1.05, 0.044, 0.050),
            (ox, 0.012 + 0.006, T * 1.55, 0.039, 0.044),
        ], sides), "red"))
        parts.append(put(loft(f"shoe_rim_{side}", [
            (ox, 0.012 + 0.006, T * 1.48, 0.041, 0.046),
            (ox, 0.012 + 0.006, T * 1.70, 0.039, 0.044),
        ], sides), "rubber", detail=True))

        if base is not None:
            pivot = bpy.data.objects.new(f"shoe_pivot_{side}", None)
            coll.objects.link(pivot)
            pivot.location = base
            pivot.rotation_euler = rot or (0.0, 0.0, 0.0)
            for ob in parts:
                ob.parent = pivot

    if pose is not None:
        build_posed(put, sides, POSES[pose], shoe, eyes, box)
    else:
        shoe("l", -1); shoe("r", 1)

    if pose is not None:
        pass
    elif form == "box":
        # ゆったりした黒Tシャツ
        put(box("tee", 0.315, 0.205, CHEST - WAIST + 0.20, loc=(0, 0, WAIST - 0.20), taper=1.04), "tee")
        put(box("chest", 0.330, 0.210, SHOULDER - CHEST, loc=(0, 0, CHEST), taper=0.94), "tee")
        put(box("shoulder_cap", 0.318, 0.202, 0.032, loc=(0, 0, SHOULDER), taper=0.82), "tee")

        # 手を指まで作るか、筒1本で済ませるか。organic は既定で指あり
        hands = conf.get("hands", "fingers" if style == "organic" else "stub")
        # 腕は arm_points の肩・肘・手首に合わせる。ここだけ別の角度で組むと、
        # 骨はこの位置に立っているのにメッシュがずれて、ポーズが合わなくなる
        for side, sgn in (("l", -1), ("r", 1)):
            sh, el, wr = arm_points(sgn)
            ua, fa = seg_tilt(sh, el), seg_tilt(el, wr)
            put(limb(f"sleeve_{side}", 0.078, 0.076, 0.148,
                     (sh.x, sh.y, sh.z + 0.032), sides, tilt=(0.0, ua)), "tee")
            put(limb(f"upperarm_{side}", 0.050, 0.044, (el - sh).length,
                     (sh.x, sh.y, sh.z), sides, tilt=(0.0, ua)), "skin")
            # 手のひらに差し込むぶん、指ありのときは前腕を手首より先へ伸ばす。
            # organic は溶かすと腕の先が痩せるので、突き合わせだと手首に隙間が空く
            over = 0.030 if hands == "fingers" else 0.0
            put(limb(f"forearm_{side}", 0.044, 0.036, (wr - el).length + over,
                     (el.x, el.y + 0.004, el.z), sides, tilt=(0.0, fa)), "skin")
            if hands == "fingers":
                # organic では指は voxel（19mm）より細いので、溶かす側に入れると消える。
                # 手だけ溶かさずに置いて、指の骨でスキニングする
                build_hand(put, side, sgn, sides, detail=(style == "organic"))
            else:
                put(limb(f"hand_{side}", 0.038, 0.030, 0.098,
                         (wr.x, wr.y + 0.006, wr.z + 0.004), sides, tilt=(0.0, fa)), "skin")

        put(limb("neck", 0.049, 0.056, 0.170, (0, 0, CHIN + 0.010), sides), "skin")
        if conf.get("head_shape", "long") == "long":
            put(box("head", 0.146 * hk, 0.162 * hk, (H - CHIN - 0.035) * hk,
                    loc=(0, 0, CHIN), taper=0.90), "skin")
            put(box("hair", 0.152 * hk, 0.168 * hk, 0.058 * hk,
                    loc=(0, 0, CHIN + 0.140 * hk), taper=0.86), "hair")
            put(box("hair_back", 0.140 * hk, 0.072 * hk, 0.132 * hk,
                    loc=(0, 0.054 * hk, CHIN + 0.052 * hk), taper=0.92), "hair")
            eye_at = dict(y=-0.084 * hk, z=CHIN + 0.070 * hk, s=hk,
                          dx=0.038, w=0.016, yaw=0.0)
        else:
            # 丸顔は箱を削るより、断面を積んだ方が素直に丸くなる。
            # organic はこのあと voxel で溶かすので、分割が多くても粗が出ない
            eye_at = build_head(put, conf, sides, CHIN - 0.005)
    else:
        # ゆったりした黒Tシャツ。肩を落として裾に向けて広げる
        put(loft("tee", [
            (0, 0.000, 0.920, 0.165, 0.114),
            (0, 0.000, 1.020, 0.168, 0.116),
            (0, 0.000, 1.140, 0.165, 0.112),
            (0, 0.000, 1.265, 0.171, 0.113),
            (0, 0.000, 1.352, 0.166, 0.109),
            (0, 0.000, 1.398, 0.148, 0.099),
            (0, 0.000, 1.422, 0.108, 0.076),
        ], sides), "tee")

        for side, sgn in (("l", -1), ("r", 1)):
            lean = 1.0 if sgn > 0 else 1.04      # 左右をわずかにずらして棒立ちを崩す
            # 袖口から肩の内側まで伸ばして、胴に溶け込ませる（切りっぱなしだと肩パッドに見える）
            sh0, _el0, wr0 = arm_points(sgn)
            def sp(t, dx=0.0, dz=0.0):
                p = sh0.lerp(wr0, t)
                return (p.x + dx, p.y, p.z + dz)
            put(loft(f"sleeve_{side}", [
                (*sp(0.27), 0.064, 0.067),
                (*sp(0.12), 0.072, 0.076),
                (*sp(0.00, -sgn * 0.016, 0.014), 0.077, 0.083),
                (*sp(0.00, -sgn * 0.050, 0.046), 0.070, 0.076),
            ], sides), "tee")
            build_hand(put, side, sgn, sides)
            sh, el, wr = arm_points(sgn)
            def ap(t, dy=0.0):
                p = sh.lerp(wr, t)
                return (p.x, p.y + dy, p.z)
            put(loft(f"arm_{side}", [
                (*ap(1.00, 0.000), 0.033, 0.036),
                (*ap(0.92, -0.002), 0.036, 0.039),
                (*ap(0.65, -0.006), 0.042, 0.045),
                (*ap(0.53, -0.004), 0.046, 0.048),
                (*ap(0.25, -0.008), 0.050, 0.053),
                (*ap(0.00, -0.010), 0.055, 0.058),
            ], sides), "skin")

        put(loft("neck", [
            (0, 0.004, 1.352, 0.058, 0.063),
            (0, 0.004, 1.455, 0.053, 0.058),
            (0, 0.004, 1.512, 0.054, 0.059),
        ], sides), "skin")
        # 顎の高さ 1.496 を軸に頭を積む
        eye_at = build_head(put, conf, sides, 1.496)

    if eyes and pose is None:
        for side, sgn in (("l", -1), ("r", 1)):
            e = box(f"eye_{side}", eye_at["w"] * eye_at["s"], 0.010 * eye_at["s"],
                    eye_at["w"] * eye_at["s"],
                    loc=(sgn * eye_at["dx"] * eye_at["s"], eye_at["y"], eye_at["z"]))
            e.rotation_euler = (0.0, 0.0, sgn * eye_at["yaw"])
            put(e, "hair", detail=True)

    if ch.get("chalk", "ground") == "waist":
        # 腰に着けたチョークバッグ。背中側（+y）に下げ、ベルトでTシャツの上から留める。
        # 骨に直付けするので、名前は chalk_ で始めない（chalk_ はリグに乗せない決まり）
        # バッグの重みで後ろが落ちる。腰骨に引っかかる高さまで下げ、
        # ベルトごと後ろ下がりに傾ける
        TILT, PIV = 11.0, (0, 0, 0.966)
        # 袋と、口をくるむ上部のバンド。バンドは袋よりわずかに太くして段を出す
        put(tilt_x(loft("hipbag", [
            (0, 0.148, 0.826, 0.046, 0.034),    # 底。丸く閉じる
            (0, 0.150, 0.848, 0.068, 0.050),
            (0, 0.152, 0.908, 0.072, 0.054),    # いちばん張るところ
            (0, 0.151, 0.944, 0.068, 0.050),
        ], gear_sides), PIV, TILT), "bag_body")
        # 口は開いていて中が見える。外側を立ち上げ、縁で折り返して内側を下ろす。
        # 1本の筒で器になる（置きバケツと同じ作り）
        put(tilt_x(loft("hipbag_band", [
            (0, 0.150, 0.938, 0.070, 0.052),    # 下端。袋に重なる
            (0, 0.149, 0.960, 0.073, 0.055),    # 口のすぐ下。少し張る
            (0, 0.149, 0.968, 0.071, 0.053),    # 口の外側
            (0, 0.149, 0.968, 0.062, 0.044),    # 縁で折り返す
            (0, 0.150, 0.920, 0.058, 0.040),    # 内側を下ろす。ここが中の底
        ], gear_sides), PIV, TILT), "bag_band")
        # 袋がクリーム色なので、ロゴは白ではなく濃い色で置く
        put(tilt_x(box("hipbag_logo", 0.040, 0.005, 0.034,
                       loc=(0, 0.212, 0.870)), PIV, TILT), "ink", detail=True)
        # ベルト。外側を立ち上げて、縁で折り返して内側を下ろす（帯になる）
        put(tilt_x(loft("hipbelt", [
            (0, 0.000, 0.952, 0.178, 0.126),
            (0, 0.000, 0.980, 0.178, 0.126),
            (0, 0.000, 0.980, 0.171, 0.119),
            (0, 0.000, 0.952, 0.171, 0.119),
        ], gear_sides), PIV, TILT), "ink", detail=True)
    else:
        # チョークバケツ＋チョークバッグ
        BX, BY = (0.34, -0.10) if pose is None else (0.66, 0.34)
        # 写真どおり、横に広くて浅い箱型。口は開いていて中が見える。
        # 外側を上まで立ち上げたら、縁で折り返して内側を下ろす。1本の筒で器になる。
        put(loft("chalk_bucket", [
            (BX, BY, 0.000, 0.086, 0.052),
            (BX, BY, 0.020, 0.108, 0.066),
            (BX, BY, 0.086, 0.124, 0.076),     # いちばん張るところ
            (BX, BY, 0.146, 0.121, 0.074),     # 口の外側
            (BX, BY, 0.150, 0.106, 0.060),     # 縁を折り返す
            (BX, BY, 0.040, 0.094, 0.052),     # 内側を下ろす
            (BX, BY, 0.026, 0.088, 0.048),     # 中の底
        ], gear_sides), "cream")
        # 口の黒い縁
        put(loft("chalk_bucket_rim", [
            (BX, BY, 0.138, 0.124, 0.076),
            (BX, BY, 0.150, 0.122, 0.074),
            (BX, BY, 0.150, 0.107, 0.061),
            (BX, BY, 0.138, 0.105, 0.059),
        ], gear_sides), "ink", detail=True)
        put(loft("chalk_bucket_base", [
            (BX, BY, 0.000, 0.088, 0.054),
            (BX, BY, 0.020, 0.108, 0.066),
        ], gear_sides), "ink", detail=True)
        put(box("chalk_bucket_scrawl", 0.058, 0.006, 0.044,
                loc=(BX + 0.044, BY - 0.078, 0.056)), "scrawl", detail=True)

        # 中に入っている黒いチョークバッグ。口から上に出て、バケツより少し横に張る。
        # 上は窄まらない。布が横一文字に折れて閉じるので、幅を保ったまま前後だけ薄くする
        bag = loft("chalk_bag", [
            (BX - 0.010, BY + 0.004, 0.052, 0.076, 0.044),
            (BX - 0.010, BY + 0.004, 0.130, 0.106, 0.054),   # バケツの口の上。いちばん張る
            (BX - 0.004, BY + 0.002, 0.212, 0.100, 0.040),   # 前後だけ薄くなっていく
            (BX + 0.008, BY + 0.000, 0.268, 0.086, 0.013),   # 口。横長の折り目。少し傾ける
        ], gear_sides)
        put(bag, "canvas")
        put(box("chalk_bag_logo", 0.048, 0.005, 0.040,
                loc=(BX - 0.008, BY - 0.048, 0.160)), "logo", detail=True)

    shape_body(coll, ch)

    if ch.get("chalk", "ground") == "waist":
        # 袋・バンド・ロゴを1つの持ち手にぶら下げる。位置を詰めるとき、
        # 持ち手を動かせばバッグ全体が動く。
        # ベルトは体に巻いてあって親の骨が違う（pelvis）ので、ここには入れない。
        # 体を縮めたあとに親を付ける。先に付けると、縮めたぶん子がずれる
        sx, sy, sz = body_scale(ch)
        group_under_empty(coll, "bag_pivot",
                          [o for o in coll.objects if o.name.split(".")[0]
                           in ("hipbag", "hipbag_band", "hipbag_logo")],
                          (0.0, 0.146 * sy, 0.940 * sz))

    if style == "organic":
        if merge:
            organic_merge(groups)
        else:
            ORGANIC_GROUPS[coll.name] = groups

    if origin_x:
        for ob in coll.objects:
            if ob.parent is None:       # 子は親が運ぶので触らない
                ob.location.x += origin_x
    print(f"[{character}:{preset}] {len(coll.objects)} objects at x={origin_x:+.2f}")
    return park_tmp(coll) if park else coll

def build_ground(character="aito", origin=(0.0, 0.0), size=20.0, suffix=None):
    """人ごとに地面を1枚。格子を離れた場所に置くときは origin をずらす。
    size は正方形なら数値、横長にしたいなら (幅, 奥行き)。
    suffix を渡すとポーズ枠がそれになる（格子用 any と壁の列用 wall を分ける）。"""
    name = make_coll_name("ground", character, NA, suffix or NA)
    old = bpy.data.collections.get(name)
    if old:
        for ob in list(old.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(old)
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    w, d = size if isinstance(size, (tuple, list)) else (size, size)
    g = box("ground", w, d, 0.02, loc=(origin[0], origin[1], -0.02))
    coll.objects.link(g)
    g.data.materials.append(flat_material("bg"))
    for p in g.data.polygons:
        p.use_smooth = False
    return coll

# ---------------------------------------------------------------- 並べ方
# style   blocky / facet / organic  … 面の作り
# head_scale  顎を軸にした頭の倍率
# hands   stub / fingers … 手を筒1本で済ませるか、指まで作るか
# head_shape  long / round … 頭の断面。HEAD_SHAPES を見る
# head_sides  頭だけ断面の分割を変える
# chin_drop   顎を首に沈める量
# eye_push    目を奥に下げる量。organic の痩せぶんを埋める
# eyes    目の点を置くか
PRESETS = {
    "blocky":  dict(style="blocky"),                          # 手は筒1本
    "blocky_fingers": dict(style="blocky", hands="fingers"),  # 指まで作る
    "facet":   dict(style="facet"),
    "organic": dict(style="organic"),
    "bighead": dict(style="facet", head_scale=1.55,
                    head_shape="round", head_sides=16, chin_drop=0.025),
    "bighead_organic": dict(style="organic", head_scale=1.55,
                            head_shape="round", head_sides=14,
                            chin_drop=0.025, eye_push=0.002),
    "noeyes":  dict(style="facet", eyes=False),
    "climb":   dict(style="facet", pose="climb"),
    "hang":    dict(style="facet", pose="hang"),
    "sit":     dict(style="facet", pose="sit"),
}

# ---------------------------------------------------------------- 実行
STYLES = globals().get("CLIMBERS_STYLES", ["blocky"])
SPACING = globals().get("CLIMBERS_SPACING", 1.15)
# CLIMBERS_STYLES = [] で読み込むと、関数だけ入れ直して何も建てない。
# ここで地面まで敷くと、格子に合わせて広げてある aito_ground が
# 既定の 20m 四方に戻ってしまう
if STYLES:
    build_ground()
    for i, st in enumerate(STYLES):
        build(st, origin_x=(i - (len(STYLES) - 1) / 2) * SPACING)


# ---------------------------------------------------------------- リグ
# 立ち姿の facet に骨を入れて、ポーズモードで動かせるようにする。
# 曲がるパーツ（脚・腕・胴・首・頭）は自動ウェイトで骨に追従させ、
# 形の変わらないもの（シューズ・目）は骨に直付けする。
RIG_BONES = [
    # (名前, head, tail, 親, つなげるか)
    ("pelvis",   (0.000,  0.000, 0.900), (0.000,  0.000, 1.020), None,       False),
    ("spine",    (0.000,  0.000, 1.020), (0.000,  0.000, 1.260), "pelvis",   True),
    ("chest",    (0.000,  0.000, 1.260), (0.000,  0.000, 1.380), "spine",    True),
    ("neck",     (0.000,  0.000, 1.380), (0.000,  0.004, 1.500), "chest",    True),
    ("head",     (0.000,  0.004, 1.500), (0.000,  0.000, 1.720), "neck",     True),
    # 腰のチョークバッグ。ベルトから吊られているので骨を1本立てて、
    # 体が傾いてもここだけ下へ垂れるようにする。バッグを持たない人では使われない
    ("bag",      (0.000,  0.146, 0.940), (0.000,  0.119, 0.800), "pelvis",   False),
]

# バッグが垂れる向き（世界座標）。骨のレストの向きと同じで、体の傾きには連れない
BAG_HANG = (0.000, -0.027, -0.140)
for _s, _x in (("R", 1.0), ("L", -1.0)):
    RIG_BONES += [
        (f"shoulder.{_s}", (_x * 0.030, 0.000, 1.360), tuple(arm_points(_x)[0]), "chest", False),
        (f"upperarm.{_s}", tuple(arm_points(_x)[0]), tuple(arm_points(_x)[1]), f"shoulder.{_s}", True),
        (f"forearm.{_s}",  tuple(arm_points(_x)[1]), tuple(arm_points(_x)[2]), f"upperarm.{_s}", True),
        (f"hand.{_s}",     hand_joints(_x)["wrist"], hand_joints(_x)["palm"], f"forearm.{_s}", True),
        (f"thigh.{_s}",    (_x * 0.098, 0.012, 0.880), (_x * 0.100, 0.000, 0.460), "pelvis", False),
        (f"shin.{_s}",     (_x * 0.100, 0.000, 0.460), (_x * 0.098, 0.014, 0.080), f"thigh.{_s}", True),
        (f"foot.{_s}",     (_x * 0.098, 0.014, 0.080), (_x * 0.098, -0.120, 0.020), f"shin.{_s}", True),
    ]

for _s, _x in (("R", 1.0), ("L", -1.0)):
    _j = hand_joints(_x)
    for _fn in [f[0] for f in FINGERS] + ["thumb"]:
        _a, _b, _c = _j[_fn]
        RIG_BONES += [
            (f"{_fn}a.{_s}", _a, _b, f"hand.{_s}", False),
            (f"{_fn}b.{_s}", _b, _c, f"{_fn}a.{_s}", True),
        ]

# 骨に直付けするもの（自動ウェイトだと潰れる小物）
RIG_DIRECT = {
    "eye_l": "head", "eye_r": "head",
    "bag_pivot": "bag",      # 袋・バンド・ロゴは、この持ち手の子として付いてくる
    "hipbelt": "pelvis",     # ベルトは体に巻いてあるので腰と一緒に動く
    "shoe_collar_l": "foot.L", "shoe_rim_l": "foot.L",
    "shoe_collar_r": "foot.R", "shoe_rim_r": "foot.R",
    "shoe_upper_l": "foot.L", "shoe_sole_l": "foot.L", "shoe_toe_l": "foot.L",
    "shoe_heel_l": "foot.L", "shoe_strap_l": "foot.L", "shoe_tab_l": "foot.L",
    "shoe_upper_r": "foot.R", "shoe_sole_r": "foot.R", "shoe_toe_r": "foot.R",
    "shoe_heel_r": "foot.R", "shoe_strap_r": "foot.R", "shoe_tab_r": "foot.R",
}
# リグに乗せないもの（持ち物・背景）
RIG_SKIP = ("chalk_", "wall", "hold_", "ground")


def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return (p - (a + ab * t)).length


# 曲げたい部位と、効かせる骨
RIG_SKIN = {
    "leg_l": ["thigh.L", "shin.L", "foot.L"],
    "leg_r": ["thigh.R", "shin.R", "foot.R"],
    "arm_l": ["chest", "shoulder.L", "upperarm.L", "forearm.L", "hand.L"],
    "arm_r": ["chest", "shoulder.R", "upperarm.R", "forearm.R", "hand.R"],
    "sleeve_l": ["chest", "shoulder.L", "upperarm.L"],
    "sleeve_r": ["chest", "shoulder.R", "upperarm.R"],
    "pants": ["pelvis", "thigh.L", "thigh.R", "shin.L", "shin.R"],   # 予備。実際は下の部分別を使う
    "tee": ["pelvis", "spine", "chest", "shoulder.L", "shoulder.R"],
    "neck": ["chest", "neck", "head"],
}
# メッシュの中の「この範囲はこの骨」。股の間が引き伸ばされるのを防ぐ
RIG_SKIN_PARTS = {
    "pants_hip":   ["pelvis", "thigh.L", "thigh.R"],
    "pants_leg_l": ["thigh.L", "shin.L"],     # 反対の脚の骨は入れない
    "pants_leg_r": ["thigh.R", "shin.R"],
}

# 手は1メッシュなので、手のひら・指それぞれの範囲に骨を割り当てる
for _side, _S in (("l", "L"), ("r", "R")):
    RIG_SKIN_PARTS[f"palm_{_side}"] = [f"hand.{_S}", f"forearm.{_S}"]
    for _fn in [f[0] for f in FINGERS] + ["thumb"]:
        RIG_SKIN_PARTS[f"{_fn}_{_side}"] = [f"hand.{_S}", f"{_fn}a.{_S}", f"{_fn}b.{_S}"]

# 形が変わらないので骨に丸ごと乗せる部位
RIG_RIGID = {
    "head": "head", "hair": "head", "hair_back": "head", "hair_curl": "head",
    "hair_side_l": "head", "hair_side_r": "head", "hair_nape": "head",
}

# facet は脚も短パンも1メッシュだが、blocky と organic は筒と箱を並べた作りで、
# 部品ごとに別のオブジェクトになる。その名前ぶんの対応をここで足す。
RIG_SKIN.update({
    "pants_hip":   RIG_SKIN_PARTS["pants_hip"],
    "pants_leg_l": RIG_SKIN_PARTS["pants_leg_l"],
    "pants_leg_r": RIG_SKIN_PARTS["pants_leg_r"],
})
RIG_SKIN.update({
    "chest":        ["spine", "chest", "shoulder.L", "shoulder.R"],
    "shoulder_cap": ["chest", "shoulder.L", "shoulder.R"],
})
for _side, _S in (("l", "L"), ("r", "R")):
    RIG_SKIN[f"thigh_{_side}"] = [f"thigh.{_S}", f"shin.{_S}"]
    RIG_SKIN[f"shin_{_side}"] = [f"thigh.{_S}", f"shin.{_S}", f"foot.{_S}"]
    RIG_SKIN[f"upperarm_{_side}"] = [f"shoulder.{_S}", f"upperarm.{_S}", f"forearm.{_S}"]
    RIG_SKIN[f"forearm_{_side}"] = [f"upperarm.{_S}", f"forearm.{_S}", f"hand.{_S}"]
    RIG_SKIN[f"hand_{_side}"] = [f"forearm.{_S}", f"hand.{_S}"]


def skin_by_distance(ob, rig, bone_names, power=4.0, keep=2, indices=None, add_modifier=True):
    """頂点ごとに、いちばん近い骨2本へ距離の逆数でウェイトを振る。
    骨と骨の間だけがなめらかに混ざるので、離れた骨に引っ張られて伸びることがない。"""
    segs = [(n,
             rig.matrix_world @ rig.data.bones[n].head_local,
             rig.matrix_world @ rig.data.bones[n].tail_local)
            for n in bone_names if n in rig.data.bones]
    for n, _, _ in segs:
        if n not in ob.vertex_groups:
            ob.vertex_groups.new(name=n)
    verts = ob.data.vertices if indices is None else [ob.data.vertices[i] for i in indices]
    for v in verts:
        p = ob.matrix_world @ v.co
        ds = sorted((_seg_dist(p, h, t), n) for n, h, t in segs)[:keep]
        ws = [(1.0 / (d ** power + 1e-9), n) for d, n in ds]
        tot = sum(w for w, _ in ws) or 1.0
        for w, n in ws:
            ob.vertex_groups[n].add([v.index], w / tot, "REPLACE")
    if add_modifier:
        md = ob.modifiers.new("armature", "ARMATURE")
        md.object = rig
        md.use_deform_preserve_volume = True    # 肘・膝・肩の折れ目が痩せるのを防ぐ
        ob.parent = rig
        ob.matrix_parent_inverse = rig.matrix_world.inverted()


def bone_weights(ob, bone_name):
    """メッシュ全体を1本の骨に 1.0 で塗る。骨に直付けするかわりに使う。
    ほかの部品と結合してひとつになるメッシュでは、直付けができないため。"""
    vg = ob.vertex_groups.get(bone_name) or ob.vertex_groups.new(name=bone_name)
    vg.add([v.index for v in ob.data.vertices], 1.0, "REPLACE")


def part_bones(ob):
    """その部品が使う骨の名前。骨に乗せない部品は None を返す。"""
    b = ob.name.split(".")[0]
    if any(b.startswith(p) for p in RIG_SKIP):
        return None
    if ob.get("skin_parts"):
        names = set()
        for tag in dict(ob["skin_parts"]):
            names.update(RIG_SKIN_PARTS[tag])
        return names
    if b in RIG_SKIN:
        return set(RIG_SKIN[b])
    if b in RIG_DIRECT:
        return {RIG_DIRECT[b]}
    if b in RIG_RIGID:
        return {RIG_RIGID[b]}
    return None


def fuse_units(obs):
    """溶かす単位に分ける。骨を共有する部品どうしだけをひとつにまとめる。
    別々に動く部位まで一緒に溶かすと、そこが1つの塊になってしまう。
    立ち姿では手が腿の横に来るので、腕と脚は触れている。そのまま溶かすと
    腕を上げたときに手と腿の間が引き伸ばされて、板が張ったように見える。"""
    parent = list(range(len(obs)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    bones = [part_bones(o) for o in obs]
    for i in range(len(obs)):
        for j in range(i + 1, len(obs)):
            together = (bones[i] & bones[j]) if (bones[i] and bones[j]) \
                else (bones[i] is None and bones[j] is None)
            if together:
                a, b = find(i), find(j)
                if a != b:
                    parent[a] = b
    units = {}
    for i, o in enumerate(obs):
        units.setdefault(find(i), []).append(o)
    return list(units.values())


def paint_weights(ob, rig):
    """部品ひとつに、その部品にふさわしいウェイトを塗る。修飾子は付けない。
    塗ったら True、骨に乗せない部品なら False を返す。"""
    b = ob.name.split(".")[0]
    if any(b.startswith(p) for p in RIG_SKIP):
        return False
    if ob.get("skin_parts"):
        for tag, (a0, b0) in dict(ob["skin_parts"]).items():
            skin_by_distance(ob, rig, RIG_SKIN_PARTS[tag],
                             indices=range(int(a0), int(b0)), add_modifier=False)
        return True
    if b in RIG_SKIN:
        skin_by_distance(ob, rig, RIG_SKIN[b], add_modifier=False)
        return True
    if b in RIG_DIRECT:
        bone_weights(ob, RIG_DIRECT[b])
        return True
    if b in RIG_RIGID:
        bone_weights(ob, RIG_RIGID[b])
        return True
    return False


def bone_parent(ob, rig, bone_name):
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = "BONE"
    ob.parent_bone = bone_name
    ob.matrix_world = mw


def smooth_weights(ob, rounds=4, factor=0.5):
    """ウェイトを、辺でつながった隣の頂点と混ぜてならす。
    溶けてひとつになったメッシュでは部品の境目でウェイトが急に切り替わるので、
    そのままだと肩や顎に角が立つ。"""
    names = [g.name for g in ob.vertex_groups]
    if len(names) < 2:
        return ob
    me = ob.data
    nb = [[] for _ in me.vertices]
    for e in me.edges:
        a, b = e.vertices
        nb[a].append(b)
        nb[b].append(a)
    slot = {g.index: k for k, g in enumerate(ob.vertex_groups)}
    w = [[0.0] * len(names) for _ in me.vertices]
    for v in me.vertices:
        for ge in v.groups:
            if ge.group in slot:
                w[v.index][slot[ge.group]] = ge.weight
    for _ in range(rounds):
        nxt = []
        for i, row in enumerate(w):
            if not nb[i]:
                nxt.append(row)
                continue
            avg = [0.0] * len(names)
            for j in nb[i]:
                wj = w[j]
                for k in range(len(names)):
                    avg[k] += wj[k]
            n = len(nb[i])
            nxt.append([row[k] * (1.0 - factor) + avg[k] / n * factor
                        for k in range(len(names))])
        w = nxt
    groups = [ob.vertex_groups[n] for n in names]
    for i, row in enumerate(w):
        tot = sum(row) or 1.0
        for k, gr in enumerate(groups):
            gr.add([i], row[k] / tot, "REPLACE")
    return ob


def armature_modifier(ob, rig):
    """アーマチュア修飾子を載せて、リグの子にする。"""
    md = ob.modifiers.new("armature", "ARMATURE")
    md.object = rig
    md.use_deform_preserve_volume = True
    ob.parent = rig
    ob.matrix_parent_inverse = rig.matrix_world.inverted()
    return md


def rig_organic(coll, rig):
    """organic は材質ごとに部品を溶かしてひとつの体にするので、骨の付け方を変える。
    溶かしたあとの頂点には、元がどの部品だったかの区別が残らない。そこで順番を入れ替える:
      部品のままウェイトを塗る → 結合する（同じ名前の頂点グループは引き継がれる）
      → 溶かす前の形を控えに取って remesh を適用 → 控えからウェイトを移す。
    remesh は頂点を作り直すため、先に塗ったウェイトはそのままでは残らない。"""
    groups = ORGANIC_GROUPS.pop(coll.name, {})
    view = bpy.context.view_layer
    skinned = rigid = 0
    units = []
    for key, obs in groups.items():
        obs = [o for o in obs if o.name in bpy.data.objects]
        if obs:
            units += [(key, u) for u in fuse_units(obs)]
    for key, obs in units:
        painted = [ob for ob in obs if paint_weights(ob, rig)]
        if painted and len(painted) < len(obs):
            # 塗り漏らした部品は溶かしたあと動かない。名前の対応表の抜けなので知らせる
            miss = [o.name for o in obs if o not in painted]
            print(f"  (ウェイトが塗れていない部品) {key}: {miss}")
        merged = organic_fuse(obs, key)
        if not painted:              # チョークなど、体に乗せないもの
            continue

        donor = merged.copy()        # 溶かす前の形。ウェイトの持ち主
        donor.data = merged.data.copy()
        coll.objects.link(donor)
        donor.modifiers.clear()

        view.objects.active = merged
        for md in list(merged.modifiers):
            bpy.ops.object.modifier_apply(modifier=md.name)
        merged.vertex_groups.clear()

        md = merged.modifiers.new("weights", "DATA_TRANSFER")
        md.object = donor
        md.use_vert_data = True
        md.data_types_verts = {"VGROUP_WEIGHTS"}
        md.vert_mapping = "POLYINTERP_NEAREST"
        bpy.ops.object.datalayout_transfer(modifier=md.name)
        bpy.ops.object.modifier_apply(modifier=md.name)
        bpy.data.objects.remove(donor, do_unlink=True)
        smooth_weights(merged)

        armature_modifier(merged, rig)
        skinned += 1

    # 溶かさない小物（目・シューズのベルクロなど）は今まで通り骨に直付けする
    for ob in list(coll.objects):
        if ob.parent is not None:          # 持ち手の子。親が運ぶので触らない
            continue
        b = ob.name.split(".")[0]
        if any(b.startswith(p) for p in RIG_SKIP):
            continue
        if ob.type == "EMPTY":
            bone = RIG_DIRECT.get(b)
            if bone:
                bone_parent(ob, rig, bone)
                rigid += 1
            continue
        if ob.type != "MESH" or ob.modifiers:
            continue
        if ob.get("skin_parts"):
            # 溶かさずに置いた手。部品ごとに指の骨で塗る
            for tag, (a0, b0) in dict(ob["skin_parts"]).items():
                skin_by_distance(ob, rig, RIG_SKIN_PARTS[tag],
                                 indices=range(int(a0), int(b0)), add_modifier=False)
            armature_modifier(ob, rig)
            skinned += 1
            continue
        bone = RIG_DIRECT.get(b) or RIG_RIGID.get(b)
        if bone:
            bone_parent(ob, rig, bone)
            rigid += 1
        else:
            print("  (リグに乗せていない):", ob.name)
    return skinned, rigid


def build_rig(origin_x=0.0, preset="facet", coll_name=None, rig_name=None,
              character="aito", park=True):
    """立ち姿を1体組んで、骨を入れて返す。戻り値は (armature, collection)。"""
    coll_name = coll_name or make_coll_name("tmp", character, preset, "stand")
    rig_name = rig_name or coll_name
    organic = PRESETS[preset]["style"] == "organic"
    coll = build(preset, origin_x=origin_x, coll_name=coll_name, merge=not organic,
                 character=character, park=False)   # 骨を入れ終わってから退ける
    sx, sy, sz = body_scale(CHARACTERS[character])

    arm = bpy.data.armatures.new(rig_name)
    rig = bpy.data.objects.new(rig_name, arm)
    coll.objects.link(rig)
    rig.location = (origin_x, 0.0, 0.0)
    rig.show_in_front = True

    view = bpy.context.view_layer
    view.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    made = {}
    for name, head, tail, parent, connect in RIG_BONES:
        b = arm.edit_bones.new(name)
        # 骨の座標も体と同じだけ縮める。片方だけだとウェイトが体からずれる
        b.head = (head[0] * sx, head[1] * sy, head[2] * sz)
        b.tail = (tail[0] * sx, tail[1] * sy, tail[2] * sz)
        if parent:
            b.parent = made[parent]
            b.use_connect = connect
        made[name] = b
    bpy.ops.object.mode_set(mode="OBJECT")

    if organic:
        skinned, rigid = rig_organic(coll, rig)
        print(f"[rig] {skinned} skinned, {rigid} bone-parented, {len(made)} bones")
        return rig, (park_tmp(coll) if park else coll)

    base = lambda n: n.split(".")[0]
    skinned = rigid = 0
    for ob in list(coll.objects):
        if ob.type not in ("MESH", "EMPTY"):
            continue
        b = base(ob.name)
        if any(b.startswith(p) for p in RIG_SKIP):
            continue
        # 親のいるものは触らない。持ち手が運ぶので、骨に二重に付けない
        if ob.parent is not None:
            continue
        if ob.type == "EMPTY":
            if b in RIG_DIRECT:
                bone_parent(ob, rig, RIG_DIRECT[b])
                rigid += 1
            continue
        if ob.get("skin_parts"):
            for tag, (a0, b0) in dict(ob["skin_parts"]).items():
                skin_by_distance(ob, rig, RIG_SKIN_PARTS[tag],
                                 indices=range(int(a0), int(b0)), add_modifier=False)
            md = ob.modifiers.new("armature", "ARMATURE")
            md.object = rig
            md.use_deform_preserve_volume = True
            ob.parent = rig
            ob.matrix_parent_inverse = rig.matrix_world.inverted()
            skinned += 1
        elif b in RIG_SKIN:
            skin_by_distance(ob, rig, RIG_SKIN[b])
            skinned += 1
        elif b in RIG_DIRECT:
            bone_parent(ob, rig, RIG_DIRECT[b])
            rigid += 1
        elif b in RIG_RIGID:
            bone_parent(ob, rig, RIG_RIGID[b])
            rigid += 1
        else:
            print("  (リグに乗せていない):", ob.name)

    print(f"[rig] {skinned} skinned, {rigid} bone-parented, {len(made)} bones")
    return rig, (park_tmp(coll) if park else coll)


# ---------------------------------------------------------------- リグにポーズを流し込む
def aim_quat(direction, hint=(0.0, -1.0, 0.0)):
    """ローカル +Y を direction に向け、ローカル +Z を hint 側に寄せた回転。
    to_track_quat はロールを勝手に決めるので、親子で軸回転がずれてメッシュがねじれる。
    体の前（-Y）を共通の基準にすれば、胴から指先までロールが揃う。"""
    y = Vector(direction).normalized()
    h = Vector(hint)
    z = h - y * h.dot(y)
    if z.length < 1e-4:                     # hint と平行なときだけ別の軸に逃がす
        alt = Vector((0.0, 0.0, 1.0)) if abs(y.z) < 0.9 else Vector((1.0, 0.0, 0.0))
        z = alt - y * alt.dot(y)
    z.normalize()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed().to_quaternion()


def _bone_targets(J):
    """骨ごとの「どこからどこへ向くか」。POSES の関節位置から作る。"""
    toe = J.get("toe_offset", (0.0, -0.115, -0.078))   # 左右で変えたいときは dict
    out = [
        ("pelvis", J["pelvis"], J["waist"]),
        ("spine",  J["waist"],  J["chest"]),
        ("chest",  J["chest"],  J["neck"]),
        ("neck",   J["neck"],   J["chin"]),
        ("head",   J["chin"],   J["crown"]),
        # バッグは体の向きに関係なく、いつも同じ向きへ垂れる
        ("bag",    (0.0, 0.0, 0.0), BAG_HANG),
    ]
    for side, k in (("R", "r"), ("L", "l")):
        ank = J["ankle"][k]
        t = toe[k] if isinstance(toe, dict) else toe
        out += [
            # 肩の骨の起点は胸の関節ではなく、胸の骨の上端寄り。
            # 胸の関節（z=1.29）から肩（z=1.36）へ向けると26度も上を向き、いかり肩になる。
            # 基本姿勢では 1.360 / 胸の骨は 1.260→1.380 なので、その 0.83 の位置に合わせる
            (f"shoulder.{side}", lerp(J["chest"], J["neck"], 0.83), J["shoulder"][k]),
            (f"upperarm.{side}", J["shoulder"][k],   J["elbow"][k]),
            (f"forearm.{side}",  J["elbow"][k],      J["wrist"][k]),
            (f"hand.{side}",     J["wrist"][k],      J["tip"][k]),
            (f"thigh.{side}",    J["hip"][k],        J["knee"][k]),
            (f"shin.{side}",     J["knee"][k],       J["ankle"][k]),
            (f"foot.{side}",     ank, tuple(Vector(ank) + Vector(t))),
        ]
    return out


def apply_pose(rig, J):
    """関節の位置から各骨の回転を求めてポーズモードに入れる。
    Blender の骨はローカル +Y 方向に伸びるので、その +Y を目標の向きへ回す。
    親から順に解いて、親の回転を打ち消したぶんだけを骨のローカル回転として置く。"""
    arm = rig.data
    world = {}
    prev_mode = bpy.context.object.mode if bpy.context.object else "OBJECT"
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")

    for name, a, b in _bone_targets(J):
        bone = arm.bones.get(name)
        if bone is None:
            continue
        pb = rig.pose.bones[name]
        # 親の動きをまず受け継ぎ、そこから目標の向きへ最小回転で振る。
        # 骨ごとに向きを絶対的に決めると、腕を大きく回したときに軸回転が反転してねじれる。
        rest_dir = (Vector(bone.tail_local) - Vector(bone.head_local)).normalized()
        target_dir = (Vector(b) - Vector(a)).normalized()
        rest_q = bone.matrix_local.to_quaternion()
        if bone.parent is not None and bone.parent.name in world:
            inherited = world[bone.parent.name] @ bone.parent.matrix_local.to_quaternion().inverted()
        else:
            inherited = Quaternion()
        swing = (inherited @ rest_dir).rotation_difference(target_dir)
        aim = swing @ inherited @ rest_q
        if bone.parent is None:
            rest_local = bone.matrix_local.to_quaternion()
            parent_world = Quaternion()
        else:
            rest_local = (bone.parent.matrix_local.inverted() @ bone.matrix_local).to_quaternion()
            parent_world = world[bone.parent.name]
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (parent_world @ rest_local).inverted() @ aim
        world[name] = aim

    # 骨の軸まわりのひねり。上の解き方は「どこを向くか」しか決めないので、
    # 手のひらをどちらに向けるかのような軸回転はここで足す。
    # 子（指）は親の軸回転を受け継ぐので、手を回せば指もついてくる。
    for name, deg in (J.get("roll") or {}).items():
        pb = rig.pose.bones.get(name)
        if pb:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = (pb.rotation_quaternion
                                      @ Quaternion((0.0, 1.0, 0.0), math.radians(deg)))

    # 手で直した姿勢をそのまま持たせる指定。
    # roll は骨の軸まわりの角度しか表せないので、一般の回転はこちらで書く。
    # aim で決めた向きを上書きするので、指定した骨はここで最終決定になる
    for name, q in (J.get("bone_pose") or {}).items():
        pb = rig.pose.bones.get(name)
        if pb:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = Quaternion(q)

    # 手のひらをどちらへ向けたいかだけ書けば、骨の軸まわりの角度は計算で出す。
    # 腕の角度を変えるたびに手首を回し直さずに済む
    for name, target in (J.get("palm_face") or {}).items():
        # 回転を書いた直後の pb.matrix は更新前の値なので、読む前に評価し直す。
        # これを忘れると片方の手だけ効かない
        bpy.context.view_layer.update()
        pb = rig.pose.bones.get(name)
        bone = rig.data.bones.get(name)
        if pb is None:
            continue
        sgn = 1.0 if name.endswith(".R") else -1.0
        rest_n = Vector((-sgn, 0.0, 0.0))            # 基本姿勢では手のひらは体側
        axis = (pb.matrix.to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()
        cur = ((pb.matrix @ bone.matrix_local.inverted()).to_3x3() @ rest_n).normalized()
        want = Vector(target).normalized()
        # 骨の軸まわりにしか回せないので、両者を軸に垂直な面へ落としてから角度を測る
        a = (cur - axis * cur.dot(axis))
        b = (want - axis * want.dot(axis))
        if a.length < 1e-5 or b.length < 1e-5:
            continue
        a.normalize(); b.normalize()
        ang = math.atan2(axis.dot(a.cross(b)), a.dot(b))
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (pb.rotation_quaternion
                                  @ Quaternion((0.0, 1.0, 0.0), ang))

    grip = J.get("grip")
    if grip or J.get("thumb_grip"):
        grip = grip or (0.0, 0.0)
        # (a, b) なら両手同じ。{"R": (a, b), "L": (a, b)} なら手ごとに変えられる
        per_side = grip if isinstance(grip, dict) else {"R": grip, "L": grip}
        for side, val in per_side.items():
            if val is None:
                continue
            a_ang, b_ang = val
            # 曲げの軸は骨のローカル Z。指は前後に並んでいるので、X で回すと
            # 手のひらへ丸まらず、横へ開いてしまう
            sg = 1.0 if side == "R" else -1.0
            for fn in [f[0] for f in FINGERS]:
                for seg, ang in (("a", a_ang), ("b", b_ang)):
                    pb = rig.pose.bones.get(f"{fn}{seg}.{side}")
                    if pb:
                        pb.rotation_mode = "QUATERNION"
                        pb.rotation_quaternion = Quaternion((0.0, 0.0, 1.0),
                                                            math.radians(ang) * sg)
            # 親指は既定で4本の45%。thumb_grip を書けばそちらが優先される
            tg = J.get("thumb_grip") or (a_ang * 0.45, b_ang * 0.45)
            # 親指は手のひらを横切るように動くので、4本とは軸が違う
            for seg, ang in (("a", tg[0]), ("b", tg[1])):
                pb = rig.pose.bones.get(f"thumb{seg}.{side}")
                if pb:
                    pb.rotation_mode = "QUATERNION"
                    pb.rotation_quaternion = Quaternion((1.0, 0.0, 0.0),
                                                        math.radians(ang))

    bpy.ops.object.mode_set(mode="OBJECT")
    # 骨の長さは変えないので、腰の位置だけオブジェクトごと動かして合わせる
    rest_pelvis = Vector(arm.bones["pelvis"].head_local)
    rig.location += Vector(J["pelvis"]) - rest_pelvis
    bpy.context.view_layer.update()
    return rig


def rig_contacts(rig, coll=None):
    """ホールドを置く位置。手は手のひらの先、足は靴のつま先の実位置を使う。
    骨の先は靴の中にあるので、そこに置くとつま先が宙に浮く。"""
    out = {}
    for name in ("hand.R", "hand.L"):
        pb = rig.pose.bones.get(name)
        if pb:
            out[name] = rig.matrix_world @ pb.tail

    dg = bpy.context.evaluated_depsgraph_get()
    for name in ("foot.R", "foot.L"):
        tip, best = None, None
        for ob in (coll.objects if coll else []):
            if ob.parent is not obj_rig(ob, rig) or ob.parent_bone != name:
                continue
            ev = ob.evaluated_get(dg)
            me = ev.to_mesh()
            for v in me.vertices:
                p = ob.matrix_world @ v.co
                score = p.y + p.z          # 前かつ下ほど小さい＝つま先
                if best is None or score < best:
                    best, tip = score, p.copy()
            ev.to_mesh_clear()
        if tip is not None:
            out[name] = tip
        else:
            pb = rig.pose.bones.get(name)
            if pb:
                out[name] = rig.matrix_world @ pb.tail
    return out


def obj_rig(ob, rig):
    return rig


def hold_data(kind, w, h, depth, seed, sides=7):
    """壁のローカル座標でホールドを1つ作る（+y が壁から手前）。
    台形の箱だと人工物すぎるので、輪郭を不規則にして、
    手のホールドは下側を抉って（インカット）指がかかる縁を作る。"""
    rng = random.Random(seed)
    incut = 0.030 if kind == "hand" else 0.006      # 前へ行くほど上へずらす量
    profile = [
        (0.000, 1.00, 0.00, 0.10),                  # (壁からの距離, 幅の倍率, 上へのずれ, 揺らぎ)
        (depth * 0.45, 1.06, incut * 0.45, 0.16),
        (depth * 0.82, 0.92, incut * 0.85, 0.14),
        (depth, 0.62, incut, 0.08),
    ]
    verts = []
    for (y, k, dz, jit) in profile:
        for i in range(sides):
            a = 2 * math.pi * i / sides + math.pi / sides
            j = 1.0 + rng.uniform(-jit, jit)
            verts.append((w * 0.5 * k * j * math.cos(a),
                          y,
                          dz + h * 0.5 * k * j * math.sin(a)))
    rings = len(profile)
    faces = [tuple(reversed(range(sides))),
             tuple(range((rings - 1) * sides, rings * sides))]
    for r in range(rings - 1):
        for i in range(sides):
            jx = (i + 1) % sides
            faces.append((r * sides + i, r * sides + jx,
                          (r + 1) * sides + jx, (r + 1) * sides + i))
    return verts, faces


def bolt_data(depth, r=0.011, sides=6):
    """ホールドの真ん中のボルト。少し奥に沈めた円盤。"""
    verts, faces = [], []
    for k, (y, rr) in enumerate(((depth * 0.80, r), (depth * 0.86, r * 0.92))):
        for i in range(sides):
            a = 2 * math.pi * i / sides
            verts.append((rr * math.cos(a), y, rr * math.sin(a)))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple(range(sides, 2 * sides)))
    for i in range(sides):
        j = (i + 1) % sides
        faces.append((i, j, sides + j, sides + i))
    return verts, faces


def add_wall_at(coll, contacts, origin_x=0.0, overhang_deg=10.0,
                only=None, offsets=None):
    """手足が触っている面に壁を立て、接点の位置にホールドを置く。
    overhang_deg は被り角。上へ行くほどクライマー側（+y）へ張り出す。
    壁とホールドは空オブジェクトにぶら下げて、まとめて傾ける。"""
    if not contacts:
        return
    # only を渡すと、その接点だけホールドを置く（足が切れているポーズ用）。
    # 壁面の位置はどの接点にも当たらないよう、全接点から決める。
    wall_pts = list(contacts.values())
    holds_at = {k: v for k, v in contacts.items() if only is None or k in only}
    offsets = offsets or {}
    phi = math.radians(overhang_deg)
    k = math.tan(phi)
    # どの接点も壁にめり込まない位置に面を置く
    a = min(p.y - k * p.z for p in wall_pts) - 0.015
    P0 = Vector((0.0, a, 0.0))
    N = Vector((0.0, math.cos(phi), -math.sin(phi)))   # 壁面の法線（クライマー側・やや下向き）
    U = Vector((0.0, math.sin(phi), math.cos(phi)))    # 壁に沿った上方向

    pivot = bpy.data.objects.new("wall_pivot", None)
    coll.objects.link(pivot)
    pivot.location = (origin_x, a, 0.0)
    pivot.rotation_euler = (-phi, 0.0, 0.0)

    made = [(box("wall", 2.40, 0.12, 2.95, loc=(0.0, -0.06, 0.0)), "wall")]
    for i, (name, p) in enumerate(sorted(holds_at.items())):
        rel = Vector((0.0, p.y, p.z)) - P0
        d = N.dot(rel)          # 壁面から接点までの距離
        u = U.dot(rel)          # 壁に沿った高さ
        foot = name.startswith("foot")
        kind = "foot" if foot else "hand"
        # 足は小さなチップを踏む。厚さ1cm ほどで、手のホールドよりずっと小さい。
        # 手は指がかかる必要があるので、接点までの距離 d ぶんだけ出す
        hw, hh = (0.045, 0.028) if foot else (0.118, 0.082)
        depth = 0.012 if foot else min(max(d + 0.020, 0.046), 0.078)
        # 手は握るので中心を合わせ、足は踏むので天面をつま先の高さに合わせる
        z0 = (u - hh * 0.42 if foot else u) + offsets.get(name, 0.0)
        ob = mesh_from(f"hold_{i}", *hold_data(kind, hw, hh, depth, seed=i * 131 + 7))
        ob.location = (p.x - origin_x, 0.0, z0)
        made.append((ob, "hold"))
        bolt = mesh_from(f"hold_bolt_{i}", *bolt_data(depth))
        bolt.location = ob.location
        made.append((bolt, "ink"))
    for ob, key in made:
        coll.objects.link(ob)
        ob.data.materials.append(flat_material(key))
        for pl in ob.data.polygons:
            pl.use_smooth = False
        ob.parent = pivot


def add_wall(coll, J, origin_x=0.0):
    """ポーズに壁が要るとき、壁とホールドを同じコレクションに足す。"""
    wy = J.get("wall_y")
    if wy is None:
        return
    made = []
    made.append((box("wall", 2.40, 0.12, 2.70, loc=(origin_x, wy - 0.06, 0.0)), "wall"))
    for i, (hx, hz) in enumerate(J.get("holds", [])):
        made.append((box(f"hold_{i}", 0.098, 0.052, 0.078,
                         loc=(origin_x + hx, wy + 0.026, hz - 0.038), taper=0.55), "hold"))
    for ob, key in made:
        coll.objects.link(ob)
        ob.data.materials.append(flat_material(key))
        for pl in ob.data.polygons:
            pl.use_smooth = False


def drop_to_ground(rig, coll):
    """壁を使わないポーズは、いちばん低い点が地面に載るよう体ごと下ろす。
    骨の長さが決まっているので、関節位置どおりだと床にめり込んだり浮いたりする。"""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    zs = []
    for ob in coll.objects:
        if ob.type != "MESH":
            continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        zs += [(ob.matrix_world @ v.co).z for v in me.vertices]
        ev.to_mesh_clear()
    if zs:
        rig.location.z -= min(zs)
        bpy.context.view_layer.update()


# 傾ける対象の関節
_POSE_PTS = ("pelvis", "waist", "chest", "neck", "chin", "crown")
_POSE_SIDES = ("shoulder", "elbow", "wrist", "tip", "hip", "knee", "ankle")


def _rot_x(p, phi, pivot=(0.0, 0.0, 0.0)):
    v = Vector(p) - Vector(pivot)
    c, s = math.cos(phi), math.sin(phi)
    return tuple(Vector(pivot) + Vector((v.x, v.y * c - v.z * s, v.y * s + v.z * c)))


def tilt_pose(J, deg, leg_back=0.55):
    """ポーズ全体を被り角ぶん寝かせる。
    壁だけ傾けると体が壁に対して直立したままになり、被り壁に見えない。
    脚は壁と平行にはならず重力で下がるので、股関節を軸に leg_back の割合だけ戻す。"""
    if not deg:
        return J
    phi = math.radians(-deg)               # 上が手前（+y）へ来る向き
    # 既定は下の足。足が壁から切れているポーズでは、掴んでいる手を軸にする
    pk = J.get("tilt_pivot", ("ankle", "l"))
    piv = J[pk[0]][pk[1]] if isinstance(pk, (tuple, list)) else J[pk]
    out = dict(J)
    for k in _POSE_PTS:
        if k in J:
            out[k] = _rot_x(J[k], phi, piv)
    for k in _POSE_SIDES:
        if k in J:
            out[k] = {sd: _rot_x(q, phi, piv) for sd, q in J[k].items()}
    # つま先の向き。左右で変えているポーズもあるので dict も受ける
    toe = J.get("toe_offset", (0.0, -0.115, -0.078))
    out["toe_offset"] = ({sd: _rot_x(q, phi) for sd, q in toe.items()}
                         if isinstance(toe, dict) else _rot_x(toe, phi))

    back = math.radians(deg * leg_back)
    for k in ("knee", "ankle"):
        if k in out:
            out[k] = {sd: _rot_x(q, back, out["hip"][sd]) for sd, q in out[k].items()}
    return out


def read_pose(rig, deg=0.0, origin=(0.0, 0.0), pivot=None, leg_back=0.55):
    """ポーズモードで手で直した骨から、POSES に書ける関節の座標を読み戻す。

    骨の位置には tilt_pose が掛けた被り角と、地面に並べたときのずらしが
    入っているので、順に取り消して「壁が垂直だったら」の姿に戻す。
    pivot はそのポーズを組んだときの tilt_pivot の点（傾ける前の座標）。
    体格の倍率が1でない人では使えない（先に aito で作ってから移す）。"""
    B = rig.pose.bones
    w = lambda n, t=False: (rig.matrix_world @ (B[n].tail if t else B[n].head)) \
        - Vector((origin[0], origin[1], 0.0))
    J = dict(
        pelvis=w("pelvis"), waist=w("pelvis", True), chest=w("spine", True),
        neck=w("chest", True), chin=w("neck", True), crown=w("head", True))
    for k, bone in (("shoulder", "shoulder"), ("elbow", "upperarm"),
                    ("wrist", "forearm"), ("tip", "hand"),
                    ("knee", "thigh"), ("ankle", "shin")):
        J[k] = {sd: w(f"{bone}.{sd.upper()}", True) for sd in ("r", "l")}
    J["hip"] = {sd: w(f"thigh.{sd.upper()}") for sd in ("r", "l")}
    toe = {sd: w(f"foot.{sd.upper()}", True) - w(f"foot.{sd.upper()}") for sd in ("r", "l")}

    if deg:
        phi, back = math.radians(-deg), math.radians(deg * leg_back)
        # 脚だけ股関節で戻してあるぶんを先に取り消す
        for k in ("knee", "ankle"):
            J[k] = {sd: Vector(_rot_x(J[k][sd], -back, J["hip"][sd])) for sd in ("r", "l")}
        piv = Vector(pivot) if pivot is not None else J["tip"]["r"]
        for k in _POSE_PTS:
            J[k] = Vector(_rot_x(J[k], -phi, piv))
        for k in _POSE_SIDES:
            J[k] = {sd: Vector(_rot_x(J[k][sd], -phi, piv)) for sd in ("r", "l")}
        toe = {sd: Vector(_rot_x(toe[sd], -phi)) for sd in ("r", "l")}
    J["toe_offset"] = toe
    return J


def pose_source(J, indent=8):
    """read_pose の結果を、そのまま POSES に貼れる形で文字にする。"""
    sp = " " * indent
    r3 = lambda p: "(" + ", ".join(f"{v:+.3f}" for v in p) + ")"
    out = []
    for k in _POSE_PTS:
        out.append(f"{sp}{k:<6}={r3(J[k])},")
    for k in _POSE_SIDES + ("toe_offset",):
        out.append(f"{sp}{k:<6}=dict(r={r3(J[k]['r'])}, l={r3(J[k]['l'])}),")
    return "\n".join(out)


def scaled_pose(J, ch):
    """関節の位置を、その人の体格に合わせて縮める。
    骨を縮めてあるので、目標の位置もそろえないと腕の開きや足の幅が型のままになる。"""
    sx, sy, sz = body_scale(ch)
    if (sx, sy, sz) == (1.0, 1.0, 1.0):
        return J

    def pt(p):
        return (p[0] * sx, p[1] * sy, p[2] * sz)

    def is_pt(q):
        return (isinstance(q, (tuple, list)) and len(q) == 3
                and all(isinstance(c, (int, float)) for c in q))

    out = {}
    for k, v in J.items():
        if k == "wall_y":
            out[k] = v * sy
        # 角度・握り・ホールドのずらし・接点の指定は座標ではないので触らない
        elif k in ("shoe_rot", "roll", "grip", "thumb_grip", "bone_pose",
                   "palm_face", "overhang", "body_tilt",
                   "contacts_only", "tilt_pivot", "holds"):
            out[k] = v
        elif k == "ground_z":
            out[k] = v * sz          # 床からの高さは身長に比例して縮む
        elif k == "hold_offset":
            out[k] = {n: d * sz for n, d in v.items()}
        elif isinstance(v, dict):
            out[k] = {side: (pt(q) if is_pt(q) else q) for side, q in v.items()}
        elif isinstance(v, (tuple, list)) and len(v) == 3 \
                and all(isinstance(c, (int, float)) for c in v):
            out[k] = pt(v)
        else:
            out[k] = v
    return out


def align_wall(coll, wall_y):
    """壁の手前面を決まった位置へ揃える。
    壁はポーズの接点に合わせて立てるので、そのままだと体の振れ方によって
    ポーズごとに奥行きがずれる。体と壁の関係は保ったまま、まとめて動かす。"""
    bpy.context.view_layer.update()
    w = next((o for o in coll.objects if o.name.split(".")[0] == "wall"), None)
    if w is None:
        return 0.0
    front = max((w.matrix_world @ v.co).y for v in w.data.vertices)
    dy = wall_y - front
    if abs(dy) < 1e-6:
        return 0.0
    for ob in coll.objects:
        if ob.parent is None:          # 子は親が運ぶ
            ob.location.y += dy
    bpy.context.view_layer.update()
    return dy


def build_rigged_pose(pose="climb", origin_x=0.0, preset="facet", coll_name=None,
                      wall=True, character="aito", overhang_deg=10.0):
    """立ち姿を骨付きで組んでから、ポーズを骨の回転として入れる。
    POSES の座標を直接メッシュに焼く build_posed と違い、あとから手で動かせる。
    作りを変えて2体並べるときは、コレクション名が重なると先の1体が消えるので
    coll_name を渡して分ける。"""
    name = coll_name or make_coll_name("tmp", character, preset, pose)
    rig, coll = build_rig(origin_x=origin_x, preset=preset, coll_name=name, rig_name=name,
                          character=character, park=False)  # 壁とポーズのあとで退ける
    # 被り角は壁のあるポーズにだけ効かせる。座りのような接地ポーズを傾けると
    # 体ごと回って、尻や足が浮く
    # 被り角はポーズ側に書いてあればそれを使う。足が切れるような姿勢は
    # 寝た壁でないと成り立たないので、格子でも一律10度にはできない
    if POSES[pose].get("wall_y") is None:
        deg = body_deg = 0.0
    else:
        deg = POSES[pose].get("overhang", overhang_deg)
        # 体の傾きは壁と完全に独立。既定は 0（関節座標に書いたとおりの姿勢）。
        # 壁を寝かせても体は勝手に倒れない。倒したいポーズだけ body_tilt を書く
        body_deg = POSES[pose].get("body_tilt", 0.0)
    J = tilt_pose(scaled_pose(POSES[pose], CHARACTERS[character]), body_deg)
    apply_pose(rig, J)
    if wall and J.get("wall_y") is not None:
        add_wall_at(coll, rig_contacts(rig, coll), origin_x=origin_x,
                    overhang_deg=deg,
                    only=J.get("contacts_only"), offsets=J.get("hold_offset"))
        align_wall(coll, J["wall_y"])
    elif J.get("ground_z") is not None:
        rig.location.z = J["ground_z"]        # 手で決めた高さをそのまま使う
        bpy.context.view_layer.update()
    elif J.get("drop_to_ground", True):
        drop_to_ground(rig, coll)
    print(f"[rig:{name}] 壁 {deg:.0f}° / 体 {body_deg:.0f}° at x={origin_x:+.2f}")
    return rig, park_tmp(coll)


# ---------------------------------------------------------------- 格子に並べる
# facet が本命なので先頭（手前の行）に置く。触る回数がいちばん多い
GRID_STYLES = ["facet", "blocky", "blocky_fingers", "organic", "bighead", "bighead_organic"]
# 立ち・座りのあとに、壁のポーズを被り角の小さい順で並べる。
# 垂壁（0°）→ 薄被り（16°）→ どっかぶり（38°）。角度は POSE_OVERHANG
GRID_POSES = [None, "natural", "sit",
              "traverse", "climb",              # 0°
              "hang", "precatch", "reach",      # 16°
              "cutloose"]                       # 38°


# コレクション名の頭。人の名前ぶんと、格子ぶん
GRID_PREFIXES = tuple(f"{k}_" for k in CHARACTERS) + ("grid_",)


def grid_coll(character, style, pose, base="stand"):
    """格子の1体ぶんのコレクション名。立ち姿はポーズ枠が stand。"""
    return make_coll_name("grid", character, style, pose or base)


# 規則の前に手作業で作った、形から機械的に直せないもの
LEGACY_ODDS = {
    "fix_hand":    "tmp_aito_facet_fixhand",
    "fix_natural": "tmp_aito_facet_fixnatural",
}


def legacy_name(name):
    """昔の名前を4枠の名前に直す。直せなければ None。

    aito だけ人の枠を省いていた・役割が真ん中にあった・道具と地面に枠が
    足りなかった、の3つを吸収する。"""
    t = name.split(".")[0].split("_")
    if parse_coll(name):
        return None                                  # すでに規則どおり
    chars = tuple(CHARACTERS)
    ch = t[0] if t[0] in chars else None
    if t[0] == "grid":                               # grid_<作り>_<ポーズ>（aito 省略）
        return make_coll_name("grid", "aito", "_".join(t[1:-1]), t[-1])
    if ch and len(t) >= 3 and t[1] == "gear":        # <人>_gear_<作り>
        return make_coll_name("gear", ch, "_".join(t[2:]), NA)
    if ch and t[1:] == ["ground"]:                   # <人>_ground
        return make_coll_name("ground", ch, NA, NA)
    if ch and len(t) == 3 and t[2] == "ground":      # <人>_<列>_ground
        return make_coll_name("ground", ch, NA, t[1])
    if ch and len(t) >= 3 and t[1] == "wall":        # <人>_wall_<ポーズ>
        return make_coll_name("wall", ch, "facet", t[-1])
    if ch and len(t) >= 2:                           # <人>_<作り>[_<ポーズ>]
        tail = t[-1] in POSES or t[-1] == "stand"
        pose = t[-1] if tail else "stand"
        style = "_".join(t[1:-1] if tail else t[1:])
        if style in PRESETS:
            return make_coll_name("tmp", ch, style, pose)
    if name.split(".")[0] in LEGACY_ODDS:             # 手で直したぶんの残り
        return LEGACY_ODDS[name.split(".")[0]]
    return None


def rename_colls(dry=True):
    """シーンのコレクション名を規則に合わせて付け直す。組み直しはしない。
    中の骨（コレクション名と同じ名前が付いている）も一緒に直す。"""
    done, stuck = [], []
    for c in list(bpy.data.collections):
        new = legacy_name(c.name)
        if new is None:
            if not parse_coll(c.name):
                stuck.append(c.name)
            continue
        if not dry:
            old = c.name
            for ob in c.objects:                     # 骨はコレクションと同名
                if ob.name.split(".")[0] == old.split(".")[0]:
                    if ob.data and ob.data.name.split(".")[0] == old.split(".")[0]:
                        ob.data.name = new
                    ob.name = new
            c.name = new
        done.append((c.name if dry else new, new))
        print(f"  {c.name if not dry else ''}".rstrip())
    print(f"[rename] {len(done)}件{'（下見）' if dry else 'を改名'}、"
          f"規則外で残ったもの {len(stuck)}件")
    for n in stuck:
        print("  のこり:", n)
    return done, stuck


def show(role=None, character=None, style=None, pose=None, ground=True):
    """見たいコレクションだけをビューレイヤーに残す。省いた枠は「何でもよい」。

        show()                          全部戻す
        show(character="manabu")        manabu の全ポーズだけ
        show(character="aito", style="facet")
        show(pose="cutloose")           全員の cutloose を見比べる

    3Dビューの `/`（ローカルビュー）と違って、マウスがどのエリアにあっても効く。
    名前の4枠で選ぶので、100体あっても目的のものだけ出せる。
    ground=True のあいだは、残した人の地面も一緒に出す。"""
    vl = bpy.context.view_layer

    def walk(lc):
        for ch in lc.children:
            yield ch
            yield from walk(ch)

    want = dict(role=role, character=character, style=style, pose=pose)
    plain = all(v is None for v in want.values())
    kept = 0
    for lc in walk(vl.layer_collection):
        p = parse_coll(lc.name)
        if p is None or p["character"] is None:     # 入れ物と規則外のものは触らない
            lc.exclude = False
            continue
        ok = plain or all(v is None or p[k] == v for k, v in want.items())
        # 地面は、その人を残すなら一緒に出す。足場が無いと宙に浮いて見える
        if not ok and ground and p["role"] == "ground" \
                and (character is None or p["character"] == character):
            ok = True
        lc.exclude = not ok
        kept += bool(ok)
    print(f"[show] {kept} コレクションを残した"
          + ("（全部）" if plain else "  " + str({k: v for k, v in want.items() if v})))
    return kept


BAG_PARTS = ("hipbag", "hipbag_band", "hipbag_logo")


def bag_instances(styles=None, poses=None, character="manabu", rebuild=False):
    """腰のチョークバッグを、作りごとに1セットだけ残して参照に置き換える。

    置きチョーク（gear_instances）と同じ考え方だが、こちらは骨に付く。
    各体の bag_pivot をそのまま参照の入れ物にするので、bag 骨に付いたままで、
    体が傾いてもバッグだけ垂れる挙動は変わらない。
    マスターを1つ直せば、その作りを使っている体が全部変わる。

    マスターはシーンに繋がない。繋ぐと原点にもう1セット立つ。"""
    styles = list(styles or ["facet"])
    poses = list(poses or GRID_POSES)
    made = 0
    for st in styles:
        name = make_coll_name("gear", character, st)
        master = bpy.data.collections.get(name)
        if rebuild and master:
            for o in list(master.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(master)
            master = None
        filled = master is not None and len(master.objects) > 0
        if master is None:
            master = bpy.data.collections.new(name)

        for ps in poses:
            coll = bpy.data.collections.get(grid_coll(character, st, ps))
            if not coll:
                continue
            piv = next((o for o in coll.objects
                        if o.name.split(".")[0] == "bag_pivot"), None)
            parts = [o for o in coll.objects if o.name.split(".")[0] in BAG_PARTS]
            if piv is None or not parts:
                continue                      # もう参照に置き換わっている
            if not filled:
                # 最初に見つかった1体ぶんをマスターへ移す。
                # 頂点は持ち手基準に直してあるので、位置をいじらずに移せる
                for o in parts:
                    o.parent = None
                    for c in list(o.users_collection):
                        c.objects.unlink(o)
                    master.objects.link(o)
                    o.name = o.name.split(".")[0]
                filled = True
            else:
                for o in parts:
                    bpy.data.objects.remove(o, do_unlink=True)
            piv.instance_type = "COLLECTION"
            piv.instance_collection = master
            made += 1
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)
    print(f"[bag] {character}: {len(styles)}作りのマスターを作り、{made}体を参照に置き換えた")
    return made


def audit_colls():
    """名前の枠ごとに数えて、規則から外れたものを並べる。
    放置されたものは『規則外』か役割 tmp に出る。"""
    ok, bad = {}, []
    for c in bpy.data.collections:
        d = parse_coll(c.name)
        if d is None:
            bad.append(c.name)
        else:
            ok.setdefault(d["role"], []).append(c.name)
    for role in COLL_ROLES:
        n = len(ok.get(role, []))
        if n:
            print(f"  {role:7s} {n:3d}")
    print(f"  規則外  {len(bad):3d}")
    for n in sorted(bad):
        print("    ", n)
    return ok, bad


# 使い捨ては格子から 30m 手前へ退ける。格子は y ±10m ほどしか使わないので、
# ここまで離せば見比べているものに紛れない
TMP_SHIFT = (0.0, -30.0)


def park_tmp(coll):
    """tmp_ のコレクションを格子から離し、`tmp` の下にまとめる。
    2度呼んでも動かない（印を付けている）。

    使い捨ては消さずに退ける。確認用に組んだものでも、あとで見たくなることが
    あるため。消すのは drop_tmp()。"""
    if not coll.name.startswith("tmp_") or coll.get("parked"):
        return coll
    parent = bpy.data.collections.get("tmp")
    if parent is None:
        parent = bpy.data.collections.new("tmp")
        bpy.context.scene.collection.children.link(parent)
    root = bpy.context.scene.collection
    if coll.name in root.children:
        root.children.unlink(coll)
    if coll.name not in parent.children:
        parent.children.link(coll)
    shift_xy(coll, *TMP_SHIFT)
    coll["parked"] = True
    return coll


def park_all_tmp():
    """シーンにある tmp_ を全部退ける。棚卸しのあとに1回呼べばよい。"""
    n = sum(1 for c in list(bpy.data.collections)
            if c.name.startswith("tmp_") and not c.get("parked")
            and park_tmp(c))
    print(f"[park] {n}件を tmp（y{TMP_SHIFT[1]:+.0f}m）へ退けた")
    return n


def drop_tmp(keep=()):
    """tmp_ を中身ごと消す。keep に名前を渡せばそれだけ残す。
    退けてあるので消さなくても邪魔にならない。要らないと分かったときだけ。"""
    gone = []
    for c in list(bpy.data.collections):
        if not c.name.startswith("tmp_") or c.name in keep:
            continue
        for ob in list(c.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        gone.append(c.name)
        bpy.data.collections.remove(c)
    print(f"[drop] {len(gone)}件を消した")
    return gone


def shift_xy(coll, dx=0.0, dy=0.0):
    """コレクションごと横・奥行きにずらす。子は親が運ぶので触らない。
    メッシュは動かさないので、共有しているデータは共有のまま残る。"""
    for ob in coll.objects:
        if ob.parent is None:
            ob.location.x += dx
            ob.location.y += dy


def shift_y(coll, dy):
    """コレクションごと奥行き方向にずらす。"""
    shift_xy(coll, 0.0, dy)


def grid_columns(poses, origin_x=0.0, spacing=2.60, wall_spacing=4.00):
    """列ごとの中心 x と、全体の幅。壁の付くポーズだけ幅を広く取る。
    被った壁は上がクライマー側へせり出すので、2.6m だと隣の列とぶつかる。"""
    widths = [wall_spacing if p and POSES[p].get("wall_y") is not None else spacing
              for p in poses]
    total = sum(widths)
    xs, acc = [], 0.0
    for w in widths:
        xs.append(origin_x - total / 2 + acc + w / 2)
        acc += w
    return xs, total


def build_grid(styles=None, poses=None, spacing=2.60, depth=3.40,
               wall=True, origin=(0.0, 0.0), character="aito", wall_spacing=4.00):
    """作りとポーズの総当たりを格子に並べる。横がポーズ、奥行きが作り。
    どれも骨付きで組むので、並べたあとに1体ずつポーズを直せる。

    間隔は壁の大きさで決まる。壁は幅2.4mあるので、列の間をそれより狭くすると
    隣の壁と重なって継ぎ目が出る。奥行きは座りポーズが1.2m使うぶんを見ている。
    壁は人形の手前（-y）に立つため、真正面から見ると手前の列が奥を隠す。
    形だけを見比べたいときは wall=False。"""
    styles = list(styles or GRID_STYLES)
    poses = list(poses or GRID_POSES)
    xs, total = grid_columns(poses, origin[0], spacing, wall_spacing)
    build_ground(character, origin,
                 size=(total + 6.4, len(styles) * depth + 5.0))
    made = []
    for row, st in enumerate(styles):
        y = origin[1] + (row - (len(styles) - 1) / 2) * depth
        for col, ps in enumerate(poses):
            x = xs[col]
            name = grid_coll(character, st, ps)
            if ps is None:
                rig, coll = build_rig(origin_x=x, preset=st, coll_name=name,
                                      rig_name=name, character=character)
            else:
                rig, coll = build_rigged_pose(ps, origin_x=x, preset=st, coll_name=name,
                                              wall=wall, character=character,
                                              overhang_deg=POSE_OVERHANG.get(ps, 0.0))
            shift_y(coll, y)
            made.append(coll)
    # チョーク一式は作りごとに1セットにして、各体はそれを参照するだけにする。
    # 全部組み直したところなので、マスターも作り直す
    gear_instances(styles, poses, rebuild=True, character=character)
    # 体は行のなかで直立に揃えて、そのあと作りをまたいで同じものをまとめる。
    # 直立を1つ直せば、その行のポーズ全部と、同じ形を使っている他の行も変わる
    link_poses(styles, poses, character=character)
    link_same_meshes([c.name for c in made])
    print(f"[grid] {len(styles)}通りの作り × {len(poses)}通りのポーズ = {len(made)}体")
    return made


# チョーク一式。位置は chalk_bucket を基準にする（ほかは箱で loc を持っている）
GEAR_PARTS = ("chalk_bucket", "chalk_bucket_rim", "chalk_bucket_base",
              "chalk_bucket_scrawl", "chalk_bag", "chalk_bag_logo")


def gear_instances(styles=None, poses=None, base="stand", rebuild=False,
                   character="aito"):
    """チョーク一式を作りごとに1セットだけ残し、各体にはその参照を1つ置く。

    一式は材質の違う6つの部品でできていて、organic ではバケツと袋にだけ
    voxel の修飾子が乗っている。1メッシュに結合すると修飾子はオブジェクト単位なので
    縁も書き文字もロゴも溶けてしまう。そこで結合はせず、6つのまま
    gear_<人>_<作り>_any というコレクションに置いて、各体はそれを参照する空オブジェクトにする。
    マスターを1つ直せば、その作りを使っている体が全部変わる。

    マスターはシーンに繋がない。繋ぐと原点にもう1セット立ってしまう。
    参照している空オブジェクトがあるかぎり消えない。"""
    styles = list(styles or GRID_STYLES)
    poses = list(poses or GRID_POSES)
    made = 0
    for st in styles:
        name = make_coll_name("gear", character, st, NA)
        master = bpy.data.collections.get(name)
        if rebuild and master:
            for o in list(master.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(master)
            master = None
        # すでにマスターがあるなら中身は作り直さない。作り直すと、
        # 既にある参照の指す先が消えてチョークが出なくなる
        filled = master is not None and len(master.objects) > 0
        if master is None:
            master = bpy.data.collections.new(name)

        for ps in poses:
            coll = bpy.data.collections.get(grid_coll(character, st, ps, base))
            if not coll:
                continue
            parts = [o for o in coll.objects if o.name.split(".")[0] in GEAR_PARTS]
            if not parts:
                continue                      # もう参照に置き換わっている
            bucket = next((o for o in parts
                           if o.name.split(".")[0] == "chalk_bucket"), None)
            if bucket is None:
                continue
            off = bucket.location.copy()
            if not filled:
                # 最初に見つかった1体ぶんをマスターに移し、原点基準に直す
                for o in parts:
                    for c in list(o.users_collection):
                        c.objects.unlink(o)
                    master.objects.link(o)
                    o.location -= off
                    o.name = o.name.split(".")[0]
                filled = True
            else:
                for o in parts:
                    bpy.data.objects.remove(o, do_unlink=True)
            e = bpy.data.objects.new(f"chalk_{st}", None)   # 参照を置く空オブジェクト
            e.empty_display_type = "PLAIN_AXES"
            e.empty_display_size = 0.08
            e.instance_type = "COLLECTION"
            e.instance_collection = master
            e.location = off
            coll.objects.link(e)
            made += 1
        if not filled:
            # 置きチョークを持たない人。空のマスターを残さない
            bpy.data.collections.remove(master)
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)
    print(f"[gear] {len(styles)}作りのマスターを作り、{made}体を参照に置き換えた")
    return made


def _use_mesh_of(src, dst):
    """dst に src のメッシュを使わせる。
    ウェイトはメッシュ側に「頂点グループの番号」で入っているので、
    先に頂点グループの並びを src と同じにしておかないと、別の骨に効いてしまう。"""
    if src.data is dst.data:
        return False
    names = [g.name for g in src.vertex_groups]
    if [g.name for g in dst.vertex_groups] != names:
        dst.vertex_groups.clear()
        for n in names:
            dst.vertex_groups.new(name=n)
    dst.data = src.data
    return True


def link_poses(styles=None, poses=None, base="stand", character="aito"):
    """同じ作りの行のなかで、直立のメッシュをほかのポーズにも使わせる。
    どのポーズも同じ立ち姿から組んで骨で曲げているだけなので、体は1つで足りる。
    残る違いは骨の回転だけになり、直立を1つ直せばその行のポーズ全部が変わる。

    ウェイトはメッシュに入っていて、skin_by_distance がワールド座標から計算する。
    列ごとに x が違うと最下位桁が揺れて、中身が同じはずのメッシュが別物になる。
    それを揃えるのがこの処理で、link_same_meshes の前に走らせる。

    壁とホールドはポーズごとに位置が違うので触らない（直立には無い）。"""
    styles = list(styles or GRID_STYLES)
    poses = [p for p in (poses or GRID_POSES) if p is not None]
    moved = 0
    for st in styles:
        src_coll = bpy.data.collections.get(grid_coll(character, st, None, base))
        if not src_coll:
            continue
        srcs = {o.name.split(".")[0]: o for o in src_coll.objects if o.type == "MESH"}
        for ps in poses:
            c = bpy.data.collections.get(grid_coll(character, st, ps, base))
            if not c:
                continue
            for ob in c.objects:
                if ob.type != "MESH":
                    continue
                src = srcs.get(ob.name.split(".")[0])
                if src is None:
                    continue
                # 頂点と面の数が食い違うものは別物なので触らない
                if (len(src.data.vertices) != len(ob.data.vertices)
                        or len(src.data.polygons) != len(ob.data.polygons)):
                    continue
                moved += _use_mesh_of(src, ob)
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)
    print(f"[link] ポーズ側 {moved} メッシュを直立のものに差し替えた")
    return moved


def _mesh_key(ob):
    """メッシュの中身をそのまま鍵にする。1つでも違えば別の形として扱う。
    ウェイトと面ごとの色まで見るので、facet の体と blocky の体は
    頂点の位置が同じでも一緒にはならない。"""
    me = ob.data
    verts = tuple(round(c, 6) for v in me.vertices for c in v.co)
    faces = tuple(i for p in me.polygons for i in p.vertices)
    sizes = tuple(len(p.vertices) for p in me.polygons)
    mats = tuple(m.name if m else "" for m in me.materials)
    cols = ()
    for ca in me.color_attributes:
        cols += (ca.name, ca.domain, ca.data_type)
        cols += tuple(round(c, 4) for d in ca.data for c in d.color)
    names = [g.name for g in ob.vertex_groups]
    weights = tuple((v.index, names[g.group] if g.group < len(names) else g.group,
                     round(g.weight, 5))
                    for v in me.vertices for g in v.groups)
    return (verts, faces, sizes, mats, cols, weights)


def link_same_meshes(coll_names=None):
    """中身が同じメッシュを1つのデータにまとめ、全員がそれを参照するようにする。
    チョークや靴のように、どの体でも同じ形のものがこれで1つになる。
    まとめたあとは、1つを編集モードで直すと同じ形のもの全部が変わる。

    位置の違いはメッシュではなくオブジェクトの location 側に入っているので、
    共有しても並びは崩れない。修飾子（organic の remesh など）もオブジェクト側に
    残るので、organic の行だけ溶けたまま、という状態も保てる。"""
    colls = ([bpy.data.collections[n] for n in coll_names] if coll_names
             else [c for c in bpy.data.collections
                   if c.name.startswith(GRID_PREFIXES)])
    seen, linked = {}, 0
    for c in colls:
        for ob in c.objects:
            if ob.type != "MESH":
                continue
            k = _mesh_key(ob)
            first = seen.get(k)
            if first is None:
                seen[k] = ob.data
            elif ob.data is not first:
                ob.data = first
                linked += 1
    # 参照のなくなった元データを片づける
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)
    print(f"[link] {linked} メッシュを共有にした（残り {len(bpy.data.meshes)} 種類）")
    return linked


def fix_normals(coll_name=None):
    """すでに作ってあるメッシュの面の向きを外向きに揃える。作り直さずに直せる。"""
    colls = ([bpy.data.collections[coll_name]] if coll_name
             else [c for c in bpy.data.collections if c.name.startswith(GRID_PREFIXES)])
    n = 0
    for c in colls:
        for ob in c.objects:
            if ob.type != "MESH":
                continue
            bm = bmesh.new()
            bm.from_mesh(ob.data)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bm.to_mesh(ob.data)
            bm.free()
            ob.data.update()
            n += 1
    print(f"[normals] {n} meshes fixed")
    return n


# ---------------------------------------------------------------- 壁の列
# 被り角ちがいの登りポーズ。左から順に壁が寝ていく
WALL_ROW = [
    ("climb",     0.0),    # 垂壁・ステップアップ
    ("traverse",  0.0),    # 垂壁・横移動
    ("precatch", 16.0),    # 薄被り・取る直前
    ("hang",     16.0),    # 薄被り・ぶら下がり
    ("cutloose", 38.0),    # どっかぶり・足切れ
]


# 格子でも同じ被り角を使う。reach は precatch の続きなので同じ薄被り
POSE_OVERHANG = dict(WALL_ROW)
POSE_OVERHANG["reach"] = 16.0


def build_wall_row(character="aito", origin=(0.0, 0.0), spacing=4.0,
                   row=None, ground=True, preset="facet"):
    """壁付きのポーズを一列に並べる。人が増えても同じ関数で同じ並びになる。

    間隔4mは壁の幅2.4mと、被ったときに上がせり出すぶんから決めている。
    格子の2.6m間隔では壁が重なる。
    地面は列の長さに合わせた横長を1枚敷く（格子の地面とは別名）。"""
    row = list(row or WALL_ROW)
    n = len(row)
    made = []
    for i, (pose, deg) in enumerate(row):
        x = origin[0] + (i - (n - 1) / 2) * spacing
        rig, coll = build_rigged_pose(pose, origin_x=x,
                                      coll_name=make_coll_name("wall", character,
                                                               preset, pose),
                                      preset=preset,
                                      overhang_deg=deg, character=character)
        shift_y(coll, origin[1])
        made.append(coll)
    if ground:
        build_ground(character, origin=origin,
                     size=(spacing * n + 2.0, 5.0), suffix="wall")
    print(f"[wall] {character}: {n}体 間隔{spacing}m at {origin}")
    return made


# ---------------------------------------------------------------- STL 書き出し
STL_SKIP = ("wall", "hold_", "ground", "chalk_")     # 人形だけ出す


STL_DIR = "/Users/myo/git/climbing-research/scripts/blender/stl"


def stl_path(character, style, pose):
    """人ごとのディレクトリに分けて、ファイル名は <作り>_<ポーズ>.stl。
    1階層に全部並べると、人が増えるほど探せなくなる。
    ホールドのように人形でないものは holds/ など別のディレクトリへ。"""
    return f"{STL_DIR}/{character}/{style}_{pose}.stl"


# 書き出すホールドの一覧。(名前, 種類, 幅, 高さ, 壁からの出, 種)
# 種は輪郭の崩し方を決める。同じ種なら毎回同じ形になる
HOLD_SET = (
    ("jug",    "hand", 0.130, 0.090, 0.078,  3),   # 深くて持ちやすい
    ("edge",   "hand", 0.118, 0.082, 0.060, 11),   # 壁で使っている標準の大きさ
    ("crimp",  "hand", 0.100, 0.062, 0.046, 23),   # 浅い
    ("pinch",  "hand", 0.086, 0.100, 0.070, 41),   # 縦長。つまむ
    ("chip_a", "foot", 0.045, 0.028, 0.012,  7),   # 壁で使っている足のチップ
    ("chip_b", "foot", 0.052, 0.032, 0.014, 19),
    ("chip_c", "foot", 0.038, 0.024, 0.010, 31),
)


def export_holds(holds=None, scale=100.0, out_dir=None):
    """ホールドだけを1つずつ STL に書き出す。人形とは別物なので、
    コレクションには残さず、作って書き出して消す。

    壁の上では裏面が -y を向いているが、印刷は平らな面を下にしたいので、
    X軸まわりに90°倒して裏面を z=0 に置く。
    倍率は人形と同じ既定 100（1/10）。実寸なら 1000。"""
    holds = list(holds or HOLD_SET)
    out_dir = out_dir or f"{STL_DIR}/holds"
    os.makedirs(out_dir, exist_ok=True)
    keep = (list(bpy.context.selected_objects), bpy.context.view_layer.objects.active)
    made = []
    for name, kind, w, h, depth, seed in holds:
        verts, faces = hold_data(kind, w, h, depth, seed=seed)
        # 裏面（y=0）が下に来るように倒す: (x, y, z) -> (x, z, y)
        ob = mesh_from(f"hold_{name}", [(x, z, y) for (x, y, z) in verts], faces)
        bpy.context.scene.collection.objects.link(ob)
        made.append((name, ob, w, h, depth))
    bpy.ops.object.select_all(action="DESELECT")
    for name, ob, w, h, depth in made:
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        path = f"{out_dir}/{name}.stl"
        bpy.ops.wm.stl_export(filepath=path, export_selected_objects=True,
                              apply_modifiers=True, global_scale=scale,
                              ascii_format=False)
        ob.select_set(False)
        print(f"[hold] {name:<7} {w*scale:5.1f} × {h*scale:5.1f} × 出 {depth*scale:4.1f}"
              f"  -> {path}")
    for name, ob, *_ in made:
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)
    bpy.ops.object.select_all(action="DESELECT")
    for o in keep[0]:
        try:
            o.select_set(True)
        except RuntimeError:
            pass
    bpy.context.view_layer.objects.active = keep[1]
    print(f"[hold] {len(made)}個を書き出した（倍率 {scale:.0f} = 1/{1000/scale:.0f}）")
    return [n for n, *_ in made]


def export_coll_stl(coll, **kw):
    """コレクション名から人・作り・ポーズを読んで、そのままファイル名にする。
    名前が規則どおりでないコレクションは書き出せない。"""
    d = parse_coll(coll)
    if not d:
        raise ValueError(f"名前が規則から外れている: {coll}")
    return export_stl(coll, stl_path(d["character"], d["style"], d["pose"]), **kw)


def export_stl(coll_name, path, include_gear=True, scale=100.0):
    """コレクション内の人形を STL に書き出す。
    リグの変形（アーマチュア修飾子）を適用した結果を出すので、ポーズが乗った形が出る。

    STL は単位を持たない。入っているのはただの数値で、読む側が mm とみなすだけ。
    既定の倍率 100 は 1/10 スケール。1m を 100 と書くので、mm で読むと 1/10 の像になる。
    実寸で出したいときは scale=1000。
    色も入らない。"""
    coll = bpy.data.collections[coll_name]
    skip = STL_SKIP if include_gear else STL_SKIP + ("shoe_",)
    targets = [ob for ob in coll.objects
               if ob.type == "MESH" and not any(ob.name.split(".")[0].startswith(p) for p in skip)]
    if not targets:
        raise RuntimeError(f"{coll_name} に書き出せるメッシュがない")

    zs = []
    for ob in targets:
        ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
        zs += [(ob.matrix_world @ v.co).z for v in ev.to_mesh().vertices]
        ev.to_mesh_clear()
    height_m = max(zs) - min(zs)


    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for ob in targets:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.wm.stl_export(filepath=path,
                          export_selected_objects=True,
                          apply_modifiers=True,
                          global_scale=scale,
                          ascii_format=False)
    bpy.ops.object.select_all(action="DESELECT")
    print(f"[stl] {coll_name}: {len(targets)} meshes, 全高 {height_m:.3f}m -> ファイル上 {height_m * scale:.0f}, {path}")
    return path
