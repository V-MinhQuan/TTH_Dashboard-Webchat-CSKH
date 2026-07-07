import time

def test():
    text = "hello this is a long text message that simulates a chat message " * 10
    rows = [text] * 50000
    words = ["word" + str(i) for i in range(100)]
    
    start = time.time()
    results = [0] * len(words)
    
    for row in rows:
        # Optimization: convert row to lowercase once
        r = row.lower()
        for i, w in enumerate(words):
            if w in r:
                results[i] += 1
                
    end = time.time()
    print(f"Time: {end-start:.2f}s")

if __name__ == "__main__":
    test()
