"""
Classify one or more images from the command line.

    python test_classifier.py path/to/image.jpg [more.png ...]

Loads the model once, then prints the prediction and every class score.
"""

import sys
import time

from classifier_service import CLASSES, InvalidImageError, classify_image, get_classifier


def main(paths: list[str]) -> int:
    if not paths:
        print(__doc__)
        return 2
    t0 = time.perf_counter()
    clf = get_classifier()
    print(f"Model: {clf.name} on {getattr(clf, 'device', '?')} ({getattr(clf, 'dtype', '?')}), "
          f"loaded in {time.perf_counter() - t0:.1f}s\n")

    status = 0
    for path in paths:
        try:
            with open(path, "rb") as f:
                data = f.read()
            t1 = time.perf_counter()
            result = classify_image(data)
            ms = (time.perf_counter() - t1) * 1000
        except FileNotFoundError:
            print(f"{path}: file not found\n")
            status = 1
            continue
        except InvalidImageError as exc:
            print(f"{path}: rejected — {exc}\n")
            status = 1
            continue

        print(f"{path}")
        print(f"Prediction: {result['class']}" + ("  (uncertain)" if result["uncertain"] else ""))
        if result["uncertain"]:
            print(f"Best guess: {result['best_guess']}")
        print(f"Confidence: {result['confidence'] * 100:.1f}%   [{ms:.0f} ms]\n")
        for cls in CLASSES:
            print(f"  {cls:<15} {result['scores'][cls] * 100:5.1f}%")
        print()
    return status


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
