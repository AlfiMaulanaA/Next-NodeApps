from flask import Flask, request, render_template, send_file

app = Flask(__name__)
modbus_list = 'modbus_list.json'
MIB_list = 'IOT_MODULAR_I2C.mib'

@app.route('/', methods=['GET'])
def root():
    return render_template('index.html')


@app.route('/modbus', methods=['POST'])
def write_file_from_text_1():
    return send_file(modbus_list, as_attachment=True)

@app.route('/MIB', methods=['POST'])
def write_file_from_text_2():
    return send_file(MIB_list, as_attachment=True)

if __name__ == '__main__':
    from waitress import serve
    serve(app, host="0.0.0.0", port=5000)