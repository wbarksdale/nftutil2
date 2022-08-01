from pathlib import Path
from solana.publickey import PublicKey
import random
import math
from PIL import Image, ImageColor, ImageDraw, ImageFont
import json
import argparse

def color_to_hex(color: int): 
    return hex(color)[2:].rjust(6, "0").upper()

def color_to_tuple(color: int):
    hex_color = color_to_hex(color)
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (r, g, b)
    

# candy machine "pack"
# /my_candymachine.cmpack
#   /creator
#   /collectionnft
#     /0.json
#     /0.jpeg
#   /collection
#     /0.json
#     /0.jpeg
#     /etc...

# Generate a candymachine
def gen_candy_machine_assets(output_dir: Path, creator_address: PublicKey, num_nfts: int = 100):
    shapes=["Triangle", "Rectangle", "Circle"]
    traits_set = set()

    # TODO make them unique?
    # Generate traits making sure the set of traits is unique
    # while len(traits_set) < num_nfts:
    #     traits_set.add([
    #         dict(
    #             trait_type="BackgroundColor",
    #             value=math.floor(random.uniform(0, pow(2, 24)))
    #         ),
    #         dict(
    #             trait_type="Shape",
    #             value=math.floor(random.uniform(0, len(shapes)))
    #         ),
    #         dict(
    #             trait_type="ShapeColor",
    #             value=math.floor(random.uniform(0, pow(2, 24)))
    #         )
    #     ])

    for idx in range(0, num_nfts):
        background_color_value = math.floor(random.uniform(0, pow(2, 24)))
        shape_value = math.floor(random.uniform(0, len(shapes)))
        shape_color_value = math.floor(random.uniform(0, pow(2, 24)))
        nft = {
            "name": f"NFT #{idx:04d}",
            "symbol": "DERP",
            "description": f"A set of {num_nfts} nfts for testing",
            "seller_fee_basis_points": 500,
            "image": f"{idx}.png",
            "attributes": [
                dict(
                    trait_type="BackgroundColor",
                    value=background_color_value
                ),
                dict(
                    trait_type="Shape",
                    value=shape_value
                ),
                dict(
                    trait_type="ShapeColor",
                    value=shape_color_value
                )
            ],
            "properties": {
                "creators": [
                    {
                        "address": str(creator_address),
                        "share": 100,
                    }
                ],
                "files": [
                    {
                        "uri": f"{idx}.png",
                        "type": "image/png",
                    }
                ],
            },
            "collection": {
                "name": "DerpCollection",
                "family": "DerpCollection",
            }
        }

        with open(output_dir / f"{idx}.json", "w") as f:
            json.dump(nft, f)

        image_size = (500, 500)
        image_center = (image_size[0] / 2, image_size[1] / 2)
        shape_size = (150, 150)
        shape_rect = [
            (image_center[0] - (shape_size[0] / 2), image_center[0] - (shape_size[0] / 2)),
            (image_center[0] + (shape_size[0] / 2), image_center[0] + (shape_size[0] / 2)),
        ]
        shape_color_tuple = color_to_tuple(shape_color_value)
        base_image = Image.new("RGB", (500, 500), color_to_tuple(background_color_value))
        draw = ImageDraw.Draw(base_image)

        if shapes[shape_value] == "Rectangle":
            draw.rectangle(shape_rect, fill=shape_color_tuple)
        elif shapes[shape_value] == "Circle":
            draw.rounded_rectangle(shape_rect, radius=shape_size[0] / 2, fill=shape_color_tuple)
        elif shapes[shape_value] == "Triangle":
            bounding_circle = (image_center, shape_size[0] / 2)
            draw.regular_polygon(bounding_circle, n_sides=3, fill=shape_color_tuple)

        text_box_size = (200, 100)
        text_box_rect = [
            (0, text_box_size[1]),
            (text_box_size[0], 0)
        ]

        draw.rectangle(text_box_rect, fill=(255, 255, 255))

        # need to point this to a font file
        # font = ImageFont.truetype("arial.ttf", 20)
        font = ImageFont.load_default()
        draw.text((10, 20), f"BG Color: {color_to_hex(background_color_value)}", fill=(0, 0, 0), font=font)
        draw.text((10, 40), f"Shape Color: {color_to_hex(shape_color_value)}", fill=(0, 0, 0), font=font)
        draw.text((10, 60), f"Shape: {shapes[shape_value]}", fill=(0, 0, 0), font=font)

        filename = output_dir / f"{idx}.png"
        base_image.save(filename, format="PNG")


def main():
    parser = argparse.ArgumentParser()
    args = parser.parse_args()

    gen_candy_machine_assets()

    
if __name__ == "__main__":
    main()
        


    