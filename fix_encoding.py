import os
import codecs

def fix_all_files(directory):
    # 遍历 src 目录下的所有文件
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                file_path = os.path.join(root, file)
                try:
                    # 尝试用 utf-8 读取，如果成功则不用管
                    with codecs.open(file_path, 'r', 'utf-8') as f:
                        f.read()
                except UnicodeDecodeError:
                    # 如果失败，说明是 GBK/ANSI 编码，进行转换
                    print(f"正在修复编码: {file_path}")
                    with codecs.open(file_path, 'r', 'gbk') as f:
                        content = f.read()
                    with codecs.open(file_path, 'w', 'utf-8') as f:
                        f.write(content)
                    print(f"-> 修复完成: {file_path}")

if __name__ == "__main__":
    # 修复 src 目录
    if os.path.exists("src"):
        fix_all_files("src")
        print("\n所有代码文件已转换为 UTF-8 编码！")
    else:
        print("未找到 src 目录，请确认该脚本是否在 D:\\code 根目录下。")