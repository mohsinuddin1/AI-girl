from PIL import Image
import os

path = r'c:\Users\mohsi\code\antiGravity\PureScanAI\assets\notificationIcon.png'
if os.path.exists(path):
    img = Image.open(path).convert('RGBA')
    datas = img.getdata()

    new_data = []
    for item in datas:
        # If the pixel is close to white (logo part)
        if item[0] > 200 and item[1] > 200 and item[2] > 200:
            new_data.append((255, 255, 255, 255))
        else:
            # Everything else (checkerboard background)
            new_data.append((0, 0, 0, 0))

    img.putdata(new_data)
    img.save(path)
    print("Notification icon processed successfully.")
else:
    print("File not found.")
