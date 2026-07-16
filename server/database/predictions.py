from bson import ObjectId
from datetime import datetime, timedelta
from pymongo import ASCENDING, DESCENDING
from database.connection import get_db, is_demo_mode

def save_prediction(user_id, input_data, prediction, probability, risk_level, business_summary, recommendations, top_features):
    """Saves a single prediction record in prediction_history."""
    db = get_db()
    try:
        user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    except Exception:
        return None
        
    prediction_doc = {
        "user_id": user_obj_id,
        "prediction_type": "single",
        "input_data": input_data,
        "prediction": prediction,
        "probability": float(probability),
        "risk_level": risk_level,
        "business_summary": business_summary,
        "recommendations": recommendations,
        "top_features": top_features,
        "created_at": datetime.utcnow()
    }
    
    result = db.prediction_history.insert_one(prediction_doc)
    prediction_doc["_id"] = result.inserted_id
    return prediction_doc

def get_prediction_history(user_id, page=1, per_page=10, start_date=None, end_date=None, risk_level=None, prediction=None, sort_by="created_at", sort_dir="desc"):
    """Fetches user prediction history with filtering, pagination, and sorting."""
    db = get_db()
    try:
        user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    except Exception:
        return {"predictions": [], "total": 0}
        
    query = {"user_id": user_obj_id}
    
    # Apply date filters
    if start_date or end_date:
        query["created_at"] = {}
        if start_date:
            query["created_at"]["$gte"] = start_date
        if end_date:
            query["created_at"]["$lte"] = end_date
            
    # Apply other filters
    if risk_level:
        query["risk_level"] = risk_level
    if prediction:
        query["prediction"] = prediction

    # Count total
    total = db.prediction_history.count_documents(query)
    
    # Query details
    sort_order = DESCENDING if sort_dir.lower() == "desc" else ASCENDING
    cursor = db.prediction_history.find(query).sort(sort_by, sort_order).skip((page - 1) * per_page).limit(per_page)
    
    predictions = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["user_id"] = str(doc["user_id"])
        predictions.append(doc)
        
    return {"predictions": predictions, "total": total}

def get_prediction_details(user_id, prediction_id):
    """Gets details of a single prediction."""
    db = get_db()
    try:
        user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        pred_obj_id = ObjectId(prediction_id) if isinstance(prediction_id, str) else prediction_id
    except Exception:
        return None
        
    doc = db.prediction_history.find_one({"_id": pred_obj_id, "user_id": user_obj_id})
    if doc:
        doc["_id"] = str(doc["_id"])
        doc["user_id"] = str(doc["user_id"])
    return doc

def delete_prediction(user_id, prediction_id):
    """Deletes one prediction from history."""
    db = get_db()
    try:
        user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        pred_obj_id = ObjectId(prediction_id) if isinstance(prediction_id, str) else prediction_id
    except Exception:
        return False
        
    result = db.prediction_history.delete_one({"_id": pred_obj_id, "user_id": user_obj_id})
    return result.deleted_count > 0

def delete_all_predictions(user_id):
    """Deletes all predictions for a user."""
    db = get_db()
    try:
        user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    except Exception:
        return False
        
    result = db.prediction_history.delete_many({"user_id": user_obj_id})
    return True

def get_dashboard_stats(user_id):
    """Generates analytics summary for user dashboard using aggregation."""
    db = get_db()
    try:
        user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    except Exception:
        return {}

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # 1. Total counts
    total_single = db.prediction_history.count_documents({"user_id": user_obj_id})
    total_batches = db.batch_predictions.count_documents({"user_id": user_obj_id})

    # If running in Demo Mode, handle calculation manually in-memory
    if is_demo_mode():
        # Get all predictions
        single_docs = list(db.prediction_history.find({"user_id": user_obj_id}))
        batch_docs = list(db.batch_predictions.find({"user_id": user_obj_id}))
        
        batch_ids = [b["_id"] for b in batch_docs]
        batch_results = []
        for b_id in batch_ids:
            batch_results.extend(list(db.batch_prediction_results.find({"batch_id": b_id})))
            
        total_customers = len(single_docs) + len(batch_results)
        
        churn_count = sum(1 for d in single_docs if d.get("prediction") == "Churn") + \
                      sum(1 for d in batch_results if d.get("prediction") == "Churn")
                      
        high_risk = sum(1 for d in single_docs if d.get("risk_level") == "High") + \
                    sum(1 for d in batch_results if d.get("risk_level") == "High")
                    
        low_risk = sum(1 for d in single_docs if d.get("risk_level") == "Low") + \
                   sum(1 for d in batch_results if d.get("risk_level") == "Low")
                   
        sum_prob = sum(d.get("probability", 0.0) for d in single_docs) + \
                   sum(d.get("probability", 0.0) for d in batch_results)
                   
        avg_prob = sum_prob / max(total_customers, 1)

        # Weeks and months counts
        week_count = sum(1 for d in single_docs if d.get("created_at") >= week_ago) + \
                     sum(b.get("total_records", 0) for b in batch_docs if b.get("created_at") >= week_ago)
                     
        month_count = sum(1 for d in single_docs if d.get("created_at") >= month_ago) + \
                      sum(b.get("total_records", 0) for b in batch_docs if b.get("created_at") >= month_ago)

        # Most influential feature
        feature_impacts = {}
        for d in single_docs:
            for tf in d.get("top_features", []):
                name = tf.get("feature")
                val = abs(tf.get("impact", 0.0))
                feature_impacts[name] = feature_impacts.get(name, 0.0) + val
        for r in batch_results:
            for tf in r.get("top_features", []):
                name = tf.get("feature")
                val = abs(tf.get("impact", 0.0))
                feature_impacts[name] = feature_impacts.get(name, 0.0) + val
                
        most_influential = max(feature_impacts, key=feature_impacts.get) if feature_impacts else "N/A"
        
    else:
        # 2. Production PyMongo Aggregation
        # Single predictions stats
        single_stats = list(db.prediction_history.aggregate([
            {"$match": {"user_id": user_obj_id}},
            {"$group": {
                "_id": None,
                "count": {"$sum": 1},
                "churn": {"$sum": {"$cond": [{"$eq": ["$prediction", "Churn"]}, 1, 0]}},
                "high": {"$sum": {"$cond": [{"$eq": ["$risk_level", "High"]}, 1, 0]}},
                "low": {"$sum": {"$cond": [{"$eq": ["$risk_level", "Low"]}, 1, 0]}},
                "prob_sum": {"$sum": "$probability"}
            }}
        ]))
        
        # Batch predictions stats (join via lookup)
        batch_stats = list(db.batch_predictions.aggregate([
            {"$match": {"user_id": user_obj_id}},
            {"$lookup": {
                "from": "batch_prediction_results",
                "localField": "_id",
                "foreignField": "batch_id",
                "as": "results"
            }},
            {"$unwind": "$results"},
            {"$group": {
                "_id": None,
                "count": {"$sum": 1},
                "churn": {"$sum": {"$cond": [{"$eq": ["$results.prediction", "Churn"]}, 1, 0]}},
                "high": {"$sum": {"$cond": [{"$eq": ["$results.risk_level", "High"]}, 1, 0]}},
                "low": {"$sum": {"$cond": [{"$eq": ["$results.risk_level", "Low"]}, 1, 0]}},
                "prob_sum": {"$sum": "$results.probability"}
            }}
        ]))

        s = single_stats[0] if single_stats else {"count": 0, "churn": 0, "high": 0, "low": 0, "prob_sum": 0.0}
        b = batch_stats[0] if batch_stats else {"count": 0, "churn": 0, "high": 0, "low": 0, "prob_sum": 0.0}
        
        total_customers = s["count"] + b["count"]
        churn_count = s["churn"] + b["churn"]
        high_risk = s["high"] + b["high"]
        low_risk = s["low"] + b["low"]
        avg_prob = (s["prob_sum"] + b["prob_sum"]) / max(total_customers, 1)

        # Weeks and months counts
        single_week = db.prediction_history.count_documents({"user_id": user_obj_id, "created_at": {"$gte": week_ago}})
        single_month = db.prediction_history.count_documents({"user_id": user_obj_id, "created_at": {"$gte": month_ago}})
        
        batch_week_agg = list(db.batch_predictions.aggregate([
            {"$match": {"user_id": user_obj_id, "created_at": {"$gte": week_ago}}},
            {"$group": {"_id": None, "total": {"$sum": "$total_records"}}}
        ]))
        batch_month_agg = list(db.batch_predictions.aggregate([
            {"$match": {"user_id": user_obj_id, "created_at": {"$gte": month_ago}}},
            {"$group": {"_id": None, "total": {"$sum": "$total_records"}}}
        ]))
        
        week_count = single_week + (batch_week_agg[0]["total"] if batch_week_agg else 0)
        month_count = single_month + (batch_month_agg[0]["total"] if batch_month_agg else 0)

        # Top feature aggregation
        top_feat_agg = list(db.prediction_history.aggregate([
            {"$match": {"user_id": user_obj_id}},
            {"$unwind": "$top_features"},
            {"$group": {
                "_id": "$top_features.feature",
                "impact": {"$sum": {"$abs": "$top_features.impact"}}
            }},
            {"$sort": {"impact": -1}},
            {"$limit": 1}
        ]))
        
        most_influential = top_feat_agg[0]["_id"] if top_feat_agg else "N/A"

    non_churn_count = total_customers - churn_count
    churn_pct = (churn_count / max(total_customers, 1)) * 100
    non_churn_pct = (non_churn_count / max(total_customers, 1)) * 100

    return {
        "total_predictions": total_single,
        "total_batch_uploads": total_batches,
        "total_customers_analyzed": total_customers,
        "high_risk_customers": high_risk,
        "low_risk_customers": low_risk,
        "churn_percentage": round(churn_pct, 2),
        "non_churn_percentage": round(non_churn_pct, 2),
        "predictions_this_week": week_count,
        "predictions_this_month": month_count,
        "most_influential_feature": most_influential,
        "avg_churn_probability": round(avg_prob, 4)
    }
