<?php

if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
}
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
    exit;
}

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] == "POST") {
    $json = json_decode(file_get_contents('php://input'));
    $time = filemtime("planner.js");
    if ($time < $json->time) {
        echo json_encode(array("time" => $time, "success" => false));
        exit;
    }

    $file = fopen("planner.js", "w");
    fwrite($file, $json->source);
    fclose($file);
    echo json_encode(array("time" => time(), "success" => true));
} else if ($_SERVER['REQUEST_METHOD'] == "GET") {
    $time = filemtime("planner.js");
    $file = fopen("planner.js", "r");
    echo json_encode(array(
        "time" => $time,
        "source" => fread($file, filesize("planner.js"))
    ));
    fclose($file);
}
