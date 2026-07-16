import os
import json
import pickle

__columns = None
__model = None

def get_columns():
    return __columns

def load_saved_artifacts():
    """Backwards compatible loader using robust path resolution."""
    print("Loading saved artifacts...start")
    global __columns, __model
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    artifacts_dir = os.path.join(base_dir, "artifacts")
    
    columns_path = os.path.join(artifacts_dir, "columns.json")
    model_path = os.path.join(artifacts_dir, "churn_model.pickle")
    
    with open(columns_path, "r") as f:
        __columns = json.load(f)['data_columns']
    
    with open(model_path, "rb") as f:
        __model = pickle.load(f)
        
    print("Loading saved artifacts...done")

if __name__ == '__main__':
    load_saved_artifacts()
    print(get_columns())