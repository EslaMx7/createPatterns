from flask import Flask, render_template, Response, request
import json
import pandas as pd
from data import dataHandler

def createResponse(status, message):
    """returns flask Response object"""
    
    if type(message) in (str, list):
        message = json.dumps(message)
    elif type(message) == pd.DataFrame:
        message = message.to_json(date_format='iso', orient='records')
    return Response(message, status=status, mimetype='application/json')

app = Flask(__name__, static_url_path='/static')

@app.route("/create")
def createPatterns():
    return render_template('create.html')

@app.route("/inspect")
def inspectPatterns():
    return render_template('inspect.html')

@app.route("/initData", methods=['POST'])
def initData():
    
    try:
        dataHandler.init(request.json)
        return createResponse(200, "Data connection successfully initialized!")
    except Exception as error:
        print(error)
        return createResponse(400, "Error during initiating data connection!")

@app.route("/loadNewData", methods=['GET'])
def loadNewData():
    
    try:
        return createResponse(200, dataHandler.load(request.args.get('dtLimit'), request.args.get('dir')))
    except Exception as error:
        print(error)
        return createResponse(400, "Error during loading new data!")

@app.route("/savePattern", methods=['POST'])
def savePattern():
    
    try:
        dataHandler.savePattern(request.json['startDt'], request.json['stopDt'], request.json['dir'])
        return createResponse(200, "New pattern was successfully saved!")
    except Exception as error:
        print(error)
        return createResponse(400, "Error during saving new pattern!")

@app.route("/loadPatterns", methods=['GET'])
def loadPatterns():

    return createResponse(200, dataHandler.loadPatterns(request.args.get('t')))

@app.route("/deletePattern", methods=['POST'])
def deletePattern():
    
    try:
        dataHandler.deletePattern(request.json['pointer'])
        return createResponse(200, "Pattern was successfully deleted!")
    except Exception as error:
        print(error)
        return createResponse(400, "Error during deleting a pattern!")

if __name__ == "__main__":
    app.run(debug=True)
