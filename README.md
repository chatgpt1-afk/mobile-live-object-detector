# Mobile Live Object Detector v0.12.0 — Phone Stand Edition

## 更新同一个 GitHub Pages 网页（3 步）
1. 解压 ZIP，把里面的 index.html、app.js、styles.css、service-worker.js、manifest.webmanifest、icon.svg 和 reference 文件夹上传到你原来的 GitHub repository，覆盖同名文件。文件放在原来 index.html 所在的位置，不要多套一层文件夹。
2. Commit changes，等 GitHub Pages 部署成功。
3. 用手机打开原来的完整网址，把末尾 ?v=0110 改成 ?v=0120。如果原网址没有参数，就添加 ?v=0120；已有其他参数时添加 &v=0120。页面应显示 VERSION 0.12.0。

改变 URL 参数只用于区分版本/避开旧缓存，不会自动上传代码，也不会保留两个可选择的旧/新系统。覆盖部署后原网址提供新代码。ZIP 不包含你的实际 GitHub Pages 地址；开发者需要这个地址才能给你完整链接或确认部署。

## 使用（首次 5 步，之后每件 3 步）
1. 打印 reference/20cm_reference_marker.pdf，选 100% / Actual Size，不要 Fit/Shrink。用卷尺确认黑色外边到另一边为 20 cm × 20 cm。它在 A4 上左右各留 5 mm；如果打印机裁切黑边，不要缩印，换能完整打印的纸张/打印机。
2. 手机支架固定，后摄镜头垂直朝桌面。卷尺量“实际使用的后摄镜头到桌面”的垂直距离。不要用手机外壳到桌面的距离。
3. Start Measurement → 输入/扫描条码 → 拍摄设置窗口输入距离和第一件商品最厚 cm（允许 0，但必须小于镜头距离）。
4. 商品先拿走，20 cm 参考纸放桌面中央、平放、边对齐预览画面、黑边全部可见 → Open Camera → Detect Reference Paper → Use Setup。
5. 拿走纸和商品 → Set Empty Background → 放入商品，确认主页面厚度 → Detect Object → Capture → 检查/手调框完整包括商品 → Confirm Frame & Measure → Save Current Record。

下一件：Next Item 或 Detect New Object → 只输入/扫描条码 → 主页面输入新商品最厚 cm → Detect Object。拍摄距离、比例和空背景继续复用，纸可以一直拿走。

支架移位、变高度、变镜头/变焦：Camera Setup（拍摄设置）→ 重新填距离并检测参考纸 → 重新保存空背景。浏览器刷新、关闭/重开相机、手机切后台导致相机关闭后也会要求重新校准，避免复用错误比例。条码扫描不支持的手机可直接输入。

## 结果说明
- Horizontal / Vertical：用于排货的保守尺寸，按轮廓各边在 0 到输入最大厚度之间的可能位置取包络，再加 5% 余量并向上保留两位小数。
- Thickness-corrected estimate：按所有轮廓边都处于最高点计算的估算，即桌面比例尺寸 × (镜头到桌面距离 − 最大厚度) / 镜头到桌面距离。对瓶子、鼓起的软袋，这个估算可能偏小，所以不会作为默认排货尺寸。
- 厚度由你手动输入，系统没有从照片自动测量第三个维度，也没有按大小猜测 Length / Width / Height。
- 理论采用正对桌面的针孔模型，假设光心接近图像中心。镜头畸变、遮挡、错误打印比例、错误框选和相机对焦造成的视角变化仍可能影响结果。保守输出可能超过实物 5%；不能保证每件商品都绝不偏小或误差始终 ≤ 5%。重要排货尺寸需卷尺核实。
- 不支持移动/倾斜手机后继续使用旧比例。校准检测要求完整、居中、近似正方形的指定图案，连续三次尺寸稳定；它不是精密镜头畸变校准。

模型参考：https://docs.opencv.org/4.5.1/d9/d0c/group__calib3d.html

## 保留功能
实时自动框、手动框、撤销/重做、条码、重复条码选择、未保存提醒、记录历史、商品裁剪图、Excel/图片 ZIP 分享保留。旧历史沿用原 localStorage / IndexedDB，旧记录的新字段为空并标明 Legacy reference。
所有数据继续保存在同一浏览器本机；GitHub Pages 不接收你的商品照片和记录。

## 验证范围
代码、参考纸几何和检测、校准复用/失效、换条码、输入验证、包络尺寸计算、历史字段与 Excel 输出会进行自动检查。真实手机镜头和实际商品精度仍需首次现场对照卷尺测试。
